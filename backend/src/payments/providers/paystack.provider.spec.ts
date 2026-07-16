import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaystackProvider } from './paystack.provider';

const PRIMARY_SECRET = 'sk_test_primary';
const PREVIOUS_SECRET = 'sk_test_previous';

function signWebhook(rawBody: Buffer, secretKey: string): string {
  return crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');
}

function createProvider(config: Record<string, string | undefined>) {
  const configService = {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService;

  return new PaystackProvider(configService);
}

describe('PaystackProvider', () => {
  const rawBody = Buffer.from(
    JSON.stringify({
      event: 'charge.success',
      data: { reference: 'ref_123' },
    }),
  );

  describe('verifyWebhookSignature', () => {
    it('accepts webhooks signed with the primary secret', () => {
      const provider = createProvider({
        PAYSTACK_SECRET_KEY: PRIMARY_SECRET,
        PAYSTACK_SECRET_KEY_PREVIOUS: PREVIOUS_SECRET,
      });

      const signature = signWebhook(rawBody, PRIMARY_SECRET);

      expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
    });

    it('accepts webhooks signed with the previous secret during rotation', () => {
      const provider = createProvider({
        PAYSTACK_SECRET_KEY: PRIMARY_SECRET,
        PAYSTACK_SECRET_KEY_PREVIOUS: PREVIOUS_SECRET,
      });

      const signature = signWebhook(rawBody, PREVIOUS_SECRET);

      expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
    });

    it('rejects webhooks signed with an unknown secret', () => {
      const provider = createProvider({
        PAYSTACK_SECRET_KEY: PRIMARY_SECRET,
        PAYSTACK_SECRET_KEY_PREVIOUS: PREVIOUS_SECRET,
      });

      const signature = signWebhook(rawBody, 'sk_test_unknown');

      expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(false);
    });

    it('falls back to primary-only verification when no previous secret is set', () => {
      const provider = createProvider({
        PAYSTACK_SECRET_KEY: PRIMARY_SECRET,
      });

      const primarySignature = signWebhook(rawBody, PRIMARY_SECRET);
      const previousSignature = signWebhook(rawBody, PREVIOUS_SECRET);

      expect(provider.verifyWebhookSignature(rawBody, primarySignature)).toBe(
        true,
      );
      expect(provider.verifyWebhookSignature(rawBody, previousSignature)).toBe(
        false,
      );
    });
  });
});
