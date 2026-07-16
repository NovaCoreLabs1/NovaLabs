import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

const PAYSTACK_BASE = 'https://api.paystack.co';

@Injectable()
export class PaystackProvider {
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly secretKey: string;
  private readonly previousSecretKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    this.previousSecretKey = this.configService.get<string>(
      'PAYSTACK_SECRET_KEY_PREVIOUS',
    );
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Initializes a Paystack payment transaction.
   * @param email - Customer email address
   * @param amountKobo - Amount to charge in kobo (smallest currency unit)
   * @param reference - Unique payment reference
   * @param callbackUrl - URL Paystack redirects to after payment
   * @param metadata - Optional additional data to attach to the transaction
   * @returns Authorization URL, access code, and reference from Paystack
   */
  async initializeTransaction(
    email: string,
    amountKobo: number,
    reference: string,
    callbackUrl: string,
    metadata?: Record<string, unknown>,
  ): Promise<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }> {
    const { data } = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: amountKobo,
        reference,
        callback_url: callbackUrl,
        metadata,
      },
      { headers: this.headers },
    );
    return data.data;
  }

  /**
   * Verifies a Paystack transaction by its reference.
   * @param reference - The unique transaction reference to verify
   * @returns Raw transaction data returned by Paystack
   */
  async verifyTransaction(reference: string): Promise<Record<string, unknown>> {
    const { data } = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: this.headers },
    );
    return data.data as Record<string, unknown>;
  }

  /**
   * Initiates a refund for a completed Paystack transaction.
   * @param transactionReference - The reference of the transaction to refund
   * @param amountKobo - Optional partial refund amount in kobo; full refund if omitted
   * @returns Raw refund data returned by Paystack
   */
  async initiateRefund(
    transactionReference: string,
    amountKobo?: number,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {
      transaction: transactionReference,
    };
    if (amountKobo) payload.amount = amountKobo;

    const { data } = await axios.post(`${PAYSTACK_BASE}/refund`, payload, {
      headers: this.headers,
    });
    return data.data as Record<string, unknown>;
  }

  /**
   * Validates the HMAC-SHA512 signature on an incoming Paystack webhook request.
   * Accepts the current secret or, during rotation, an optional previous secret.
   * @param rawBody - Raw request body buffer
   * @param signature - Value of the x-paystack-signature header
   * @returns True if the signature matches, false otherwise
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (this.matchesWebhookSignature(rawBody, signature, this.secretKey)) {
      return true;
    }

    if (
      this.previousSecretKey &&
      this.matchesWebhookSignature(rawBody, signature, this.previousSecretKey)
    ) {
      return true;
    }

    return false;
  }

  private matchesWebhookSignature(
    rawBody: Buffer,
    signature: string,
    secretKey: string,
  ): boolean {
    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }
}
