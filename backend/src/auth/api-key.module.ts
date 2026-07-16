import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyEntity } from './entities/api-key.entity';
import { ApiKeyAuditLogEntity } from './entities/api-key-audit.entity';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyService } from './services/api-key.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKeyEntity, ApiKeyAuditLogEntity])],
  providers: [ApiKeyGuard, ApiKeyService],
  exports: [ApiKeyGuard, ApiKeyService],
})
export class ApiKeyModule {}