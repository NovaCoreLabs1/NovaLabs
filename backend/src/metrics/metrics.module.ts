import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricsAuthGuard } from './metrics-auth.guard';

/**
 * MetricsModule — Issue #118
 *
 * Exposes a Prometheus-compatible `/api/metrics` endpoint. Access is
 * gated by `MetricsAuthGuard`: a dedicated scrape bearer token
 * (`METRICS_SCRAPE_TOKEN`) and/or an admin JWT. Register this module in
 * `AppModule` to activate the endpoint.
 *
 * A reverse-proxy IP allow-list is a valid extra control (not enforced
 * here). See `docs/SECRETS.md` for Prometheus job configuration.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsAuthGuard],
  exports: [MetricsService],
})
export class MetricsModule {}
