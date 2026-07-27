import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';

/**
 * Issue #39 — Feature flag module.
 *
 * Registers the in-process FeatureFlagsService globally so any module
 * can inject `FeatureFlagsService` and call `getBoolean('booking-wizard-v2')`.
 * Optionally swapped for the OpenFeature SDK provider at a later
 * milestone.
 */
@Module({
  providers: [FeatureFlagsService],
  controllers: [FeatureFlagsController],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
