import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';
import { InvoicesService } from '../../invoices/invoices.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { EmailService } from '../../email/email.service';
import { SorobanEscrowProvider } from './soroban-escrow.provider';
import { MetricsService } from '../../metrics/metrics.service';

/**
 * Dispatches fire-and-forget side effects after a payment webhook has been
 * processed.  Extracted from HandleWebhookProvider to keep the core
 * orchestration (atomic status transitions, booking resolution) focused and
 * testable in isolation.
 *
 * Every public method in this provider is designed to NEVER throw — all
 * failures are logged and counted via Prometheus so they don't turn the
 * webhook endpoint into a retry loop.
 */
@Injectable()
export class WebhookSideEffectsProvider {
  private readonly logger = new Logger(WebhookSideEffectsProvider.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly invoicesService: InvoicesService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly sorobanEscrowProvider: SorobanEscrowProvider,
    private readonly metricsService: MetricsService,
  ) {}

  // ── Invoices ────────────────────────────────────────────────────────

  /** Generate an invoice for a successful payment (async, best-effort). */
  fireInvoiceGeneration(paymentId: string): void {
    this.invoicesService.generateForPayment(paymentId).catch((err: Error) => {
      this.logger.error(
        `Failed to generate invoice for payment ${paymentId}: ${err.message}`,
      );
    });
  }

  // ── Emails ──────────────────────────────────────────────────────────

  /** Send a payment-success email (async, best-effort). */
  firePaymentSuccessEmail(payment: Payment, booking: Booking | null): void {
    void (async () => {
      const [user, bk] = await Promise.all([
        this.usersRepository.findOne({ where: { id: payment.userId } }),
        this.bookingsRepository.findOne({ where: { id: payment.bookingId } }),
      ]);
      const emailRecipient =
        user?.email ?? (bk?.isGuestBooking ? bk?.guestInfo?.email : null);
      const displayName =
        user?.fullName ?? (bk?.isGuestBooking ? bk?.guestInfo?.name : null);
      if (!emailRecipient || !displayName) return;
      const emailed = await this.emailService.sendPaymentSuccessEmail(
        emailRecipient,
        displayName,
        {
          bookingId: payment.bookingId,
          workspaceName: bk?.workspaceId ?? '',
          amountNaira: (payment.amount / 100).toFixed(2),
          paidAt: payment.paidAt
            ? new Date(payment.paidAt).toLocaleString()
            : '',
          invoiceNumber: '',
        },
      );
      if (!emailed) {
        this.logger.warn(
          `Failed to queue payment-success email for booking ${payment.bookingId}`,
        );
      }
    })().catch((err) =>
      this.logger.warn(
        `Failed to send payment-success email for booking ${payment.bookingId}: ${err.message}`,
      ),
    );
  }

  /** Send a payment-failed email (async, best-effort). */
  firePaymentFailedEmail(payment: Payment): void {
    void (async () => {
      let recipient: { email: string; name: string } | null = null;
      if (payment.userId) {
        const user = await this.usersRepository.findOne({
          where: { id: payment.userId },
        });
        if (user) recipient = { email: user.email, name: user.fullName };
      } else {
        const bk = await this.bookingsRepository.findOne({
          where: { id: payment.bookingId },
        });
        if (bk?.guestInfo?.email) {
          recipient = { email: bk.guestInfo.email, name: bk.guestInfo.name };
        }
      }
      if (!recipient) return;
      const emailed = await this.emailService.sendPaymentFailedEmail(
        recipient.email,
        recipient.name,
        {
          paymentReference: payment.providerReference ?? payment.id,
          amountNaira: (payment.amount / 100).toFixed(2),
        },
      );
      if (!emailed) {
        this.logger.warn(
          `Failed to queue payment-failed email for booking ${payment.bookingId}`,
        );
      }
    })().catch((err) =>
      this.logger.warn(
        `Failed to send payment-failed email for booking ${payment.bookingId}: ${err.message}`,
      ),
    );
  }

  // ── Notifications ───────────────────────────────────────────────────

  /** Create a PAYMENT_SUCCESS notification (async, best-effort). */
  firePaymentSuccessNotification(payment: Payment): void {
    if (!payment.userId) return;
    this.notificationsService
      .create({
        userId: payment.userId,
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Payment Successful',
        message: `Your payment of ₦${(payment.amount / 100).toFixed(2)} has been confirmed and your booking is now active.`,
        metadata: { paymentId: payment.id, bookingId: payment.bookingId },
      })
      .catch(() => void 0);
  }

  /** Create a PAYMENT_FAILED notification (async, best-effort). */
  firePaymentFailedNotification(payment: Payment): void {
    if (!payment.userId) return;
    this.notificationsService
      .create({
        userId: payment.userId,
        type: NotificationType.PAYMENT_FAILED,
        title: 'Payment Failed',
        message: 'Your payment could not be processed. Please try again.',
        metadata: { paymentId: payment.id, bookingId: payment.bookingId },
      })
      .catch(() => void 0);
  }

  // ── Soroban escrow ──────────────────────────────────────────────────

  /**
   * Record an on-chain Soroban escrow for a long-term booking.
   *
   * The write-back to `booking.sorobanEscrowId` is conditional
   * (`WHERE sorobanEscrowId IS NULL`) so a concurrent process that
   * completed first does not get overwritten.
   *
   * Never throws — failures are logged + counted via Prometheus.
   */
  async recordSorobanEscrow(payment: Payment, booking: Booking): Promise<void> {
    try {
      const releaseAfterUnix =
        Math.floor(new Date(booking.endDate).getTime() / 1000) + 86400;

      const txHash = await this.sorobanEscrowProvider.createEscrow(
        booking.id,
        payment.amount,
        `Booking ${booking.id}`,
        releaseAfterUnix,
      );

      // Conditional write-back: only set sorobanEscrowId if it isn't already
      // populated (another concurrent process may have completed first).
      const updateResult = await this.bookingsRepository
        .createQueryBuilder()
        .update(Booking)
        .set({ sorobanEscrowId: txHash })
        .where('id = :id AND sorobanEscrowId IS NULL', { id: booking.id })
        .execute();

      if ((updateResult.affected ?? 0) === 0) {
        this.logger.warn(
          `Soroban escrow tx ${txHash} created but sorobanEscrowId already set on booking ${booking.id} — write-back skipped`,
        );
      }

      this.logger.log(
        `Soroban escrow recorded for booking ${booking.id}: ${txHash}`,
      );
    } catch (err) {
      this.logger.error(
        JSON.stringify({
          event: 'soroban_escrow_failed',
          operation: 'create_escrow',
          bookingId: booking.id,
          paymentId: payment.id,
          amount: payment.amount,
          error: (err as Error).message,
        }),
      );
      this.metricsService.recordSorobanEscrowFailure('create_escrow');
    }
  }
}
