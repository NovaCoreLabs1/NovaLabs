import { PaystackProvider } from './paystack.provider';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaystackProvider', () => {
  let provider: PaystackProvider;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('sk_test_123'),
    };
    provider = new PaystackProvider(configService as any);
  });

  describe('initializeTransaction', () => {
    it('makes a POST request to Paystack and returns authorization data', async () => {
      const paystackResponse = {
        data: {
          data: {
            authorization_url: 'https://paystack.com/authorize',
            access_code: 'abc123',
            reference: 'ref-1',
          },
        },
      };
      mockedAxios.post.mockResolvedValue(paystackResponse);

      const result = await provider.initializeTransaction(
        'user@example.com',
        500000,
        'ref-1',
        'https://example.com/callback',
        { bookingId: 'booking-1' },
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/initialize',
        {
          email: 'user@example.com',
          amount: 500000,
          reference: 'ref-1',
          callback_url: 'https://example.com/callback',
          metadata: { bookingId: 'booking-1' },
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_123',
          }),
        }),
      );
      expect(result.authorization_url).toBe('https://paystack.com/authorize');
      expect(result.reference).toBe('ref-1');
    });
  });

  describe('verifyTransaction', () => {
    it('makes a GET request to Paystack and returns transaction data', async () => {
      const paystackResponse = {
        data: {
          data: { id: 1, status: 'success', reference: 'ref-1' },
        },
      };
      mockedAxios.get.mockResolvedValue(paystackResponse);

      const result = await provider.verifyTransaction('ref-1');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/verify/ref-1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_123',
          }),
        }),
      );
      expect(result.status).toBe('success');
    });
  });

  describe('initiateRefund', () => {
    it('makes a POST request to refund with full amount by default', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { id: 1, status: 'pending' } },
      });

      const result = await provider.initiateRefund('ref-1');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/refund',
        { transaction: 'ref-1' },
        expect.any(Object),
      );
      expect(result.status).toBe('pending');
    });

    it('includes amount when partial refund is requested', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { data: { id: 1 } },
      });

      await provider.initiateRefund('ref-1', 250000);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/refund',
        { transaction: 'ref-1', amount: 250000 },
        expect.any(Object),
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('returns true when HMAC-SHA512 signature matches', () => {
      const rawBody = Buffer.from('{"event":"charge.success"}');
      const expectedHash = crypto
        .createHmac('sha512', 'sk_test_123')
        .update(rawBody)
        .digest('hex');

      const result = provider.verifyWebhookSignature(rawBody, expectedHash);

      expect(result).toBe(true);
    });

    it('returns false when HMAC-SHA512 signature does not match', () => {
      const rawBody = Buffer.from('{"event":"charge.success"}');

      const result = provider.verifyWebhookSignature(
        rawBody,
        'invalid-signature',
      );

      expect(result).toBe(false);
    });
  });
});
