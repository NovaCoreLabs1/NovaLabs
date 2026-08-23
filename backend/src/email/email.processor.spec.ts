import { Job } from 'bull';
import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';
import { EMAIL_QUEUE_NAME, EmailJobPayload } from './email-queue.constants';
import { MetricsService } from '../metrics/metrics.service';

describe('EmailProcessor (issue #231 — retries and dead-letter)', () => {
  const payload: EmailJobPayload = {
    to: 'a@b.com',
    subject: 'Verify Your Email',
    html: '<p>123456</p>',
  };

  const makeMetricsStub = (): MetricsService =>
    ({
      emailEnqueued: { inc: jest.fn() },
      emailEnqueueFailures: { inc: jest.fn() },
      emailDeadLettered: { inc: jest.fn() },
    }) as unknown as MetricsService;

  const makeJob = (overrides: Partial<Job<EmailJobPayload>> = {}) =>
    ({
      id: '42',
      name: 'verification-otp',
      data: payload,
      attemptsMade: 1,
      opts: { attempts: 5 },
      ...overrides,
    }) as unknown as Job<EmailJobPayload>;

  const setup = () => {
    const emailService = {
      deliver: jest.fn().mockResolvedValue(undefined),
    } as unknown as EmailService;
    const deadLetterQueue = { add: jest.fn().mockResolvedValue({}) };
    const metrics = makeMetricsStub();
    const processor = new EmailProcessor(
      emailService,
      deadLetterQueue as any,
      metrics,
    );
    return { processor, emailService, deadLetterQueue, metrics };
  };

  it('delivers the rendered payload via EmailService', async () => {
    const { processor, emailService, deadLetterQueue } = setup();
    await processor.handle(makeJob());
    expect(emailService.deliver).toHaveBeenCalledWith(payload);
    expect(deadLetterQueue.add).not.toHaveBeenCalled();
  });

  describe('handleFailure', () => {
    it('does not dead-letter while retry attempts remain', async () => {
      const { processor, deadLetterQueue, metrics } = setup();

      await processor.handleFailure(
        makeJob({ attemptsMade: 2, opts: { attempts: 5 } }),
        new Error('smtp 421'),
      );

      expect(deadLetterQueue.add).not.toHaveBeenCalled();
      expect(metrics.emailDeadLettered.inc).not.toHaveBeenCalled();
    });

    it('copies the job to the DLQ with error metadata on final failure', async () => {
      const { processor, deadLetterQueue, metrics } = setup();
      const job = makeJob({ attemptsMade: 5, opts: { attempts: 5 } });

      await processor.handleFailure(job, new Error('smtp 550'));

      expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
      const [name, data] = deadLetterQueue.add.mock.calls[0];
      expect(name).toBe('verification-otp');
      expect(data.payload).toEqual(payload);
      expect(data.error).toBe('smtp 550');
      expect(data.originalJobId).toBe('42');
      expect(metrics.emailDeadLettered.inc).toHaveBeenCalledWith({
        kind: 'verification-otp',
      });
    });

    it('treats a job without explicit attempts config as single-attempt', async () => {
      const { processor, deadLetterQueue } = setup();
      const job = makeJob({ attemptsMade: 1, opts: {} });

      await processor.handleFailure(job, new Error('boom'));

      expect(deadLetterQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  it('consumes the generic email queue', () => {
    expect(EMAIL_QUEUE_NAME).toBe('email');
  });
});
