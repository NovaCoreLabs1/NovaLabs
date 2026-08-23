import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MetricsModule } from '../metrics/metrics.module';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import {
  EMAIL_DLQ_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
} from './email-queue.constants';

/**
 * Global email module (issue #231).
 *
 * Registers the durable `email` queue plus its dead-letter queue and wires
 * the producer facade (EmailService) to the SMTP consumer (EmailProcessor).
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: EMAIL_QUEUE_NAME },
      { name: EMAIL_DLQ_QUEUE_NAME },
    ),
    MetricsModule,
  ],
  providers: [EmailProcessor, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
