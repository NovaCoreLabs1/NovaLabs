import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './providers/audit-log.service';
import { CreateAuditLogProvider } from './providers/create-audit-log.provider';
import { FindAuditLogsProvider } from './providers/find-audit-logs.provider';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    CreateAuditLogProvider,
    FindAuditLogsProvider,
    AuditLogInterceptor,
  ],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule {}
