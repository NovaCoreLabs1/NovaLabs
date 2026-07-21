import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { SecurityIpLog } from './entities/security-ip-log.entity';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './providers/audit-log.service';
import { CreateAuditLogProvider } from './providers/create-audit-log.provider';
import { FindAuditLogsProvider } from './providers/find-audit-logs.provider';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { SecurityIpLogService } from './providers/security-ip-log.service';
import { AuditLogPurgeService } from './providers/audit-log-purge.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, SecurityIpLog])],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    CreateAuditLogProvider,
    FindAuditLogsProvider,
    AuditLogInterceptor,
    SecurityIpLogService,
    AuditLogPurgeService,
  ],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule {}
