import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { InjectQueue } from '@nestjs/bull';
import { MetricsService } from '../metrics/metrics.service';
import {
  EMAIL_QUEUE_NAME,
  EMAIL_RETRY_ATTEMPTS,
  EMAIL_RETRY_BACKOFF_DELAY_MS,
  EmailAttachment,
  EmailJobPayload,
  REQUIRED_TEMPLATES,
} from './email-queue.constants';

/**
 * Transactional email facade.
 *
 * Every public method renders its template from the boot-time cache and
 * enqueues a fully rendered job on the durable `email` Bull queue instead of
 * talking to SMTP directly (issue #231). SMTP failures inside the processor
 * are retried with exponential backoff and dead-lettered after the final
 * attempt — callers no longer need fire-and-forget error swallowing.
 *
 * Two delivery contracts:
 * - Critical sends (verification / password-reset OTP and links) throw a
 *   ServiceUnavailableException when the enqueue fails so auth flows surface
 *   "email is down" to the caller instead of silently succeeding.
 * - Informational sends (booking/payment/newsletter/contact/…) keep the
 *   boolean contract: `false` means the job could not be enqueued; transient
 *   SMTP failures are handled by the queue's retry policy.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly compiledTemplates = new Map<
    string,
    handlebars.TemplateDelegate
  >();

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(EMAIL_QUEUE_NAME)
    private readonly emailQueue: Queue<EmailJobPayload>,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Compiles every `.hbs` template once at startup. A missing required
   * template fails the deploy here instead of failing one user's email at
   * runtime (previously a missing file threw synchronously out of
   * `fs.readFileSync` mid-request).
   */
  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });

    const templatesDir = path.join(__dirname, 'templates');
    for (const file of fs.readdirSync(templatesDir)) {
      if (file.endsWith('.hbs')) {
        const name = file.replace(/\.hbs$/, '');
        this.compiledTemplates.set(
          name,
          handlebars.compile(
            fs.readFileSync(path.join(templatesDir, file), 'utf8'),
          ),
        );
      }
    }

    const missing = this.requiredTemplateNames().filter(
      (name) => !this.compiledTemplates.has(name),
    );
    if (missing.length > 0) {
      throw new Error(
        `Missing required email templates in ${templatesDir}: ${missing.join(', ')}`,
      );
    }
    this.logger.log(
      `Compiled ${this.compiledTemplates.size} email template(s) at boot`,
    );
  }

  protected requiredTemplateNames(): string[] {
    return [...REQUIRED_TEMPLATES];
  }

  /**
   * Renders a template from the boot-time cache.
   * @param templateName - Name of the .hbs template (without extension)
   * @param context - Key-value pairs injected into the template
   * @returns Rendered HTML string
   */
  render(templateName: string, context: Record<string, unknown>): string {
    const template = this.compiledTemplates.get(templateName);
    if (!template) {
      throw new Error(`Unknown email template "${templateName}"`);
    }
    return template(context);
  }

  /**
   * Delivers an already-rendered job over SMTP. Used exclusively by
   * EmailProcessor; throws so Bull applies the retry policy.
   */
  async deliver(payload: EmailJobPayload): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('EMAIL_FROM'),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.contentBase64, 'base64'),
        contentType: a.contentType,
      })),
    });
    this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
  }

  private attachment(
    filename: string,
    content: Buffer,
    contentType: string,
  ): EmailAttachment {
    return { filename, contentBase64: content.toString('base64'), contentType };
  }

  /** Critical: throws when the job cannot be durably queued. */
  private async enqueueCritical(
    kind: string,
    payload: EmailJobPayload,
  ): Promise<true> {
    try {
      await this.emailQueue.add(kind, payload, {
        attempts: EMAIL_RETRY_ATTEMPTS,
        backoff: { type: 'exponential', delay: EMAIL_RETRY_BACKOFF_DELAY_MS },
        removeOnComplete: 100,
        removeOnFail: false,
      });
    } catch (error) {
      this.metricsService.emailEnqueueFailures.inc({ kind });
      throw new ServiceUnavailableException(
        `Email delivery is temporarily unavailable: ${(error as Error).message}`,
      );
    }
    this.metricsService.emailEnqueued.inc({ kind });
    return true;
  }

  /** Best-effort: never throws; returns false when the enqueue failed. */
  private async enqueueBestEffort(
    kind: string,
    payload: EmailJobPayload,
  ): Promise<boolean> {
    try {
      return await this.enqueueCritical(kind, payload);
    } catch (error) {
      this.logger.warn(
        `Failed to queue email to ${payload.to}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    otp: string,
    fullName: string,
  ): Promise<true> {
    const html = this.render('verification-otp', { otp, fullName });
    return this.enqueueCritical('verification-otp', {
      to: email,
      subject: 'Verify Your Email',
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    otp: string,
    fullName: string,
  ): Promise<true> {
    const html = this.render('password-reset-otp', { otp, fullName });
    return this.enqueueCritical('password-reset-otp', {
      to: email,
      subject: 'Password Reset Code',
      html,
    });
  }

  async sendVerificationLinkEmail(
    email: string,
    token: string,
    fullName: string,
  ): Promise<true> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || '';
    const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const html = this.render('verification-link', { fullName, verifyUrl });
    return this.enqueueCritical('verification-link', {
      to: email,
      subject: 'Verify Your Email',
      html,
    });
  }

  async sendPasswordResetLinkEmail(
    email: string,
    fullName: string,
    resetLink: string,
  ): Promise<true> {
    const html = this.render('password-reset-link', { fullName, resetLink });
    return this.enqueueCritical('password-reset-link', {
      to: email,
      subject: 'Reset Your Password',
      html,
    });
  }

  async sendPasswordResetSuccessEmail(
    email: string,
    fullName: string,
  ): Promise<boolean> {
    const html = this.render('password-reset-success', { fullName });
    return this.enqueueBestEffort('password-reset-success', {
      to: email,
      subject: 'Password Reset Successful',
      html,
    });
  }

  async sendTemplateEmail(
    email: string,
    subject: string,
    templateName: string,
    placeholders: Record<string, unknown>,
  ): Promise<boolean> {
    const html = this.render(templateName, placeholders);
    return this.enqueueBestEffort(templateName, { to: email, subject, html });
  }

  async sendContactConfirmation(
    email: string,
    fullName: string,
    subject: string,
  ): Promise<boolean> {
    const html = this.render('contact-confirmation', { fullName, subject });
    return this.enqueueBestEffort('contact-confirmation', {
      to: email,
      subject: 'We received your message',
      html,
    });
  }

  async sendContactNotification(
    fullName: string,
    email: string,
    subject: string,
    message: string,
  ): Promise<boolean> {
    const adminEmail =
      this.configService.get<string>('ADMIN_EMAIL') ||
      this.configService.get<string>('EMAIL_FROM');
    const html = this.render('contact-notification', {
      fullName,
      email,
      subject,
      message,
    });
    return this.enqueueBestEffort('contact-notification', {
      to: adminEmail,
      subject: `New Contact: ${subject}`,
      html,
    });
  }

  async sendBookingCreatedEmail(
    email: string,
    fullName: string,
    data: {
      bookingId: string;
      workspaceName: string;
      planType: string;
      startDate: string;
      endDate: string;
      seatCount: number;
      totalAmountNaira: string;
    },
  ): Promise<boolean> {
    const html = this.render('booking-created', { fullName, ...data });
    return this.enqueueBestEffort('booking-created', {
      to: email,
      subject: 'Booking Created — NovaLabs',
      html,
    });
  }

  async sendPaymentSuccessEmail(
    email: string,
    fullName: string,
    data: {
      bookingId: string;
      workspaceName: string;
      amountNaira: string;
      paidAt: string;
      invoiceNumber: string;
    },
  ): Promise<boolean> {
    const html = this.render('payment-success', { fullName, ...data });
    return this.enqueueBestEffort('payment-success', {
      to: email,
      subject: 'Payment Successful — NovaLabs',
      html,
    });
  }

  async sendPaymentFailedEmail(
    email: string,
    fullName: string,
    data: {
      paymentReference: string;
      amountNaira: string;
    },
  ): Promise<boolean> {
    const html = this.render('payment-failed', { fullName, ...data });
    return this.enqueueBestEffort('payment-failed', {
      to: email,
      subject: 'Payment Failed — NovaLabs',
      html,
    });
  }

  async sendBookingCancelledEmail(
    email: string,
    fullName: string,
    data: {
      bookingId: string;
      workspaceName: string;
      startDate: string;
      endDate: string;
      cancelledBy: string;
    },
  ): Promise<boolean> {
    const html = this.render('booking-cancelled', { fullName, ...data });
    return this.enqueueBestEffort('booking-cancelled', {
      to: email,
      subject: 'Booking Cancelled — NovaLabs',
      html,
    });
  }

  async sendInvoiceReadyEmail(
    email: string,
    fullName: string,
    data: {
      invoiceNumber: string;
      amountNaira: string;
      paidAt: string;
    },
    pdfBuffer: Buffer,
  ): Promise<boolean> {
    const html = this.render('invoice-ready', { fullName, ...data });
    return this.enqueueBestEffort('invoice-ready', {
      to: email,
      subject: `Invoice ${data.invoiceNumber} — NovaLabs`,
      html,
      attachments: [
        this.attachment(
          `${data.invoiceNumber}.pdf`,
          pdfBuffer,
          'application/pdf',
        ),
      ],
    });
  }

  async sendRefreshTokenFamilyRevokedEmail(
    email: string,
    fullName: string,
  ): Promise<boolean> {
    const html = this.render('refresh-family-revoked', {
      fullName,
      year: new Date().getFullYear(),
    });
    return this.enqueueBestEffort('refresh-family-revoked', {
      to: email,
      subject: 'Your Session Was Revoked — NovaLabs',
      html,
    });
  }
}
