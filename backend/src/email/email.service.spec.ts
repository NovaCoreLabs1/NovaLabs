import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { EmailService } from './email.service';
import { EMAIL_RETRY_ATTEMPTS, EmailJobPayload } from './email-queue.constants';
import { MetricsService } from '../metrics/metrics.service';

describe('EmailService (issue #231 — durable queue delivery)', () => {
  const makeMetricsStub = (): MetricsService =>
    ({
      emailEnqueued: { inc: jest.fn() },
      emailEnqueueFailures: { inc: jest.fn() },
      emailDeadLettered: { inc: jest.fn() },
    }) as unknown as MetricsService;

  const makeQueue = () => ({ add: jest.fn().mockResolvedValue({}) });

  const makeConfig = (overrides: Record<string, string> = {}) =>
    ({
      get: jest.fn(
        (key: string) => overrides[key] ?? (`${key}-value` as unknown),
      ),
    }) as unknown as ConfigService;

  /** Service whose onModuleInit runs against the real src/email/templates dir. */
  const makeService = (
    queue = makeQueue(),
    metrics = makeMetricsStub(),
    config = makeConfig({ FRONTEND_URL: 'https://app.test' }),
  ) => {
    const service = new EmailService(config, queue as any, metrics);
    service.onModuleInit();
    // Swap the real SMTP transport for a stub; nothing must dial out in tests
    (service as any).transporter = {
      sendMail: jest.fn().mockResolvedValue({}),
    };
    return {
      service,
      queue,
      metrics,
      sendMail: (service as any).transporter.sendMail,
    };
  };

  it('boots successfully when every required template ships', () => {
    expect(() => makeService()).not.toThrow();
  });

  it('fails the boot when a required template is missing', () => {
    class BrokenEmailService extends EmailService {
      protected requiredTemplateNames(): string[] {
        return [...super.requiredTemplateNames(), 'definitely-missing'];
      }
    }
    const service = new BrokenEmailService(
      makeConfig(),
      makeQueue() as any,
      makeMetricsStub(),
    );
    expect(() => service.onModuleInit()).toThrow(
      /Missing required email templates.*definitely-missing/,
    );
  });

  it('compiles templates once and renders from the in-memory cache', () => {
    const readSpy = jest.spyOn(fs, 'readFileSync');
    const { service } = makeService();
    const callsAfterBoot = readSpy.mock.calls.length;

    const first = service.render('verification-otp', {
      otp: '123456',
      fullName: 'Ada',
    });
    const second = service.render('verification-otp', {
      otp: '654321',
      fullName: 'Grace',
    });
    expect(first).toContain('123456');
    expect(second).toContain('654321');
    expect(readSpy.mock.calls.length).toBe(callsAfterBoot);
    readSpy.mockRestore();
  });

  it('render() throws for an unknown template name', () => {
    const { service } = makeService();
    expect(() => service.render('nope', {})).toThrow(/Unknown email template/);
  });

  describe('critical sends', () => {
    it('enqueue a fully rendered job with the retry policy', async () => {
      const { service, queue } = makeService();
      await expect(
        service.sendVerificationEmail('a@b.com', '123456', 'Ada'),
      ).resolves.toBe(true);

      expect(queue.add).toHaveBeenCalledTimes(1);
      const [name, payload, options] = queue.add.mock.calls[0];
      expect(name).toBe('verification-otp');
      expect(payload.to).toBe('a@b.com');
      expect(payload.html).toContain('123456');
      expect(options.attempts).toBe(EMAIL_RETRY_ATTEMPTS);
      expect(options.backoff.type).toBe('exponential');
      expect(options.removeOnFail).toBe(false);
    });

    it('throw ServiceUnavailableException when the queue is unreachable', async () => {
      const failingQueue = {
        add: jest.fn().mockRejectedValue(new Error('redis down')),
      };
      const metrics = makeMetricsStub();
      const { service } = makeService(failingQueue, metrics);

      await expect(
        service.sendPasswordResetEmail('a@b.com', '123456', 'Ada'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(metrics.emailEnqueueFailures.inc).toHaveBeenCalledWith({
        kind: 'password-reset-otp',
      });
    });
  });

  describe('best-effort sends', () => {
    it('return false instead of throwing when the queue is unreachable', async () => {
      const failingQueue = {
        add: jest.fn().mockRejectedValue(new Error('redis down')),
      };
      const { service } = makeService(failingQueue);

      await expect(
        service.sendBookingCreatedEmail('a@b.com', 'Ada', {
          bookingId: 'bk1',
          workspaceName: 'Hub',
          planType: 'DAILY',
          startDate: '2026-01-01',
          endDate: '2026-01-02',
          seatCount: 1,
          totalAmountNaira: '5000.00',
        }),
      ).resolves.toBe(false);
    });

    it('serialise PDF attachments as base64 for Redis transport', async () => {
      const { service, queue } = makeService();
      const pdf = Buffer.from('%PDF-fake');

      await service.sendInvoiceReadyEmail(
        'a@b.com',
        'Ada',
        { invoiceNumber: 'INV-1', amountNaira: '10.00', paidAt: '' },
        pdf,
      );

      const [, payload] = queue.add.mock.calls[0] as [
        string,
        EmailJobPayload,
        Record<string, unknown>,
      ];
      expect(payload.attachments?.[0]?.contentBase64).toBe(
        pdf.toString('base64'),
      );
      expect(payload.attachments?.[0]?.contentType).toBe('application/pdf');
    });
  });

  it('deliver() sends rendered payload over SMTP and decodes attachments', async () => {
    const { service, sendMail } = makeService();
    const pdf = Buffer.from('%PDF-fake');
    await service.deliver({
      to: 'a@b.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      attachments: [
        {
          filename: 'INV-1.pdf',
          contentBase64: pdf.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
        subject: 'Hi',
        html: '<p>Hi</p>',
        attachments: [expect.objectContaining({ content: pdf })],
      }),
    );
  });
});
