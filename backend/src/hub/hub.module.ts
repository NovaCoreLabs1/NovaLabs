import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hub } from './entities/hub.entity';
import { TenantInterceptor } from './tenant.interceptor';

/**
 * Hub (multi-tenant) module.
 *
 * Registered globally so that `Hub` repository and `TenantInterceptor`
 * are available everywhere without per-module imports.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Hub])],
  providers: [TenantInterceptor],
  exports: [TypeOrmModule, TenantInterceptor],
})
export class HubModule {}
