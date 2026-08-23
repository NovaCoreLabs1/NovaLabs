import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue, Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { MetricsService } from '../metrics/metrics.service';
import { EmailService } from './email.service';
import {
  EMAIL_DLQ_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  EmailJobPayload,
} from './email-queue.constants';

/**
 * Consumes the durable `email` queue (issue #231).
 *
 * The job payload is fully rendered HTML, so this processor only talks to
 * SMTP. Throwing inside the handler is what drives Bull's retry policy
 * (attempts + exponential backoff configured at enqueue time); once every
 * attempt is exhausted the job is copied to the `email-dlq` queue for
 * inspection instead of vanishing.
 */
@Processor(EMAIL_QUEUE_NAME)
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectQueue(EMAIL_DLQ_QUEUE_NAME)
    private readonly deadLetterQueue: Queue,
    private readonly metricsService: MetricsService,
  ) {}

  @Process()
  async handle(job: Job<EmailJobPayload>): Promise<void> {
    await this.emailService.deliver(job.data);
  }

  @OnQueueFailed()
  async handleFailure(job: Job<EmailJobPayload>, error: Error): Promise<void> {
    const attempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= attempts;

    if (!exhausted) {
      this.logger.warn(
        `Email job ${job.id} (${job.name}) to ${job.data.to} failed; ` +
          `attempt ${job.attemptsMade}/${attempts}: ${error.message}`,
      );
      return;
    }

    await this.deadLetterQueue.add(
      job.name,
      {
        payload: job.data,
        error: error.message,
        failedAt: new Date().toISOString(),
        originalJobId: String(job.id),
      },
      { removeOnComplete: true, removeOnFail: false },
    );
    this.metricsService.emailDeadLettered.inc({ kind: job.name });
    this.logger.error(
      `Email job ${job.id} (${job.name}) to ${job.data.to} dead-lettered after ` +
        `${attempts} attempts: ${error.message}`,
    );
  }
}
