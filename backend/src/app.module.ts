import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guard/jwt.auth.guard';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { NAMED_THROTTLERS } from './app.throttlers';
import { NewsletterModule } from './newsletter/newsletter.module';
import { EmailModule } from './email/email.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ContactModule } from './contact/contact.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WorkspaceTrackingModule } from './workspace-tracking/workspace-tracking.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { SecretsModule } from './config/secrets';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { HubModule } from './hub/hub.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    // Named throttlers (incl. the strict day-pass buckets) live in
    // ./app.throttlers.ts — see there for why each entry carries a skipIf.
    ThrottlerModule.forRoot(NAMED_THROTTLERS),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const tls = configService.get<string>('REDIS_TLS') === 'true';
        return {
          redis: {
            host: configService.get<string>('REDIS_HOST') || 'localhost',
            port: configService.get<number>('REDIS_PORT') || 6379,
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB') || 0,
            ...(tls && { tls: {} }),
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // Connection resolution lives in ./config/typeorm.config.ts so the
      // migration CLI shares the exact same options (see issue #228).
      useFactory: (configService: ConfigService) => ({
        ...buildTypeOrmOptions((key) => configService.get<string>(key)),
        // NestJS-only: register entities from every imported module on top
        // of the shared glob.
        autoLoadEntities: true,
      }),
    }),
    EmailModule,
    AuthModule,
    UsersModule,
    NewsletterModule,
    ContactModule,
    DashboardModule,
    WorkspacesModule,
    BookingsModule,
    PaymentsModule,
    InvoicesModule,
    NotificationsModule,
    WorkspaceTrackingModule,
    SecretsModule.forRoot(),
    AuditLogModule,
    HubModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
