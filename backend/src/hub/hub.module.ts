import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hub } from './entities/hub.entity';
import { TenantInterceptor } from './tenant.interceptor';
import { DefaultHubService } from './default-hub.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

/**
 * Hub (multi-tenant) module.
 *
 * Registered globally so that `Hub` repository, `TenantInterceptor` and
 * `DefaultHubService` are available everywhere without per-module imports.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Hub]), AuditLogModule],
  providers: [TenantInterceptor, DefaultHubService],
  exports: [TypeOrmModule, TenantInterceptor, DefaultHubService],
})
export class HubModule {}
