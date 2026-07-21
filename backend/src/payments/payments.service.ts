import { Injectable, NotFoundException } from '@nestjs/common';
import { InitializePaymentProvider } from './providers/initialize-payment.provider';
import { HandleWebhookProvider } from './providers/handle-webhook.provider';
import { RefundPaymentProvider } from './providers/refund-payment.provider';
import {
  FindPaymentsProvider,
  PaymentQuery,
} from './providers/find-payments.provider';
import { UserRole } from '../users/enums/userRoles.enum';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly initializePaymentProvider: InitializePaymentProvider,
    private readonly handleWebhookProvider: HandleWebhookProvider,
    private readonly refundPaymentProvider: RefundPaymentProvider,
    private readonly findPaymentsProvider: FindPaymentsProvider,
  ) {}

  /**
   * Initializes a Paystack payment session for a booking.
   * @param bookingId - UUID of the booking to pay for
   * @param userId - ID of the user initiating payment
   * @returns Paystack authorization URL and reference
   */
  initialize(bookingId: string, userId: string) {
    return this.initializePaymentProvider.initialize(bookingId, userId);
  }

  /**
   * Processes an incoming Paystack webhook event.
   * Verifies the HMAC signature before processing.
   * @param rawBody - Raw request body for signature verification
   * @param signature - Value of the x-paystack-signature header
   */
  handleWebhook(rawBody: Buffer, signature: string, requestTime: string) {
    return this.handleWebhookProvider.handle(rawBody, signature, requestTime);
  }

  /**
   * Initiates a refund for a completed payment.
   * Users can only refund their own payments; admins can refund any.
   * @param paymentId - UUID of the payment to refund
   * @param userId - ID of the requesting user
   * @param userRole - Role of the requesting user
   */
  refund(paymentId: string, userId: string, userRole: UserRole) {
    return this.refundPaymentProvider.refund(paymentId, userId, userRole);
  }

  /**
   * Lists payments with optional filters and pagination.
   * @param query - Filter/pagination options
   * @param userId - Requesting user ID
   * @param userRole - Requesting user role
   */
  findAll(query: PaymentQuery, userId: string, userRole: UserRole) {
    return this.findPaymentsProvider.findAll(query, userId, userRole);
  }

  async findById(paymentId: string, userId: string, userRole: UserRole) {
    const payment = await this.findPaymentsProvider.findById(
      paymentId,
      userId,
      userRole,
    );
    if (!payment) {
      throw new NotFoundException(`Payment "${paymentId}" not found`);
    }
    return payment;
  }
}
