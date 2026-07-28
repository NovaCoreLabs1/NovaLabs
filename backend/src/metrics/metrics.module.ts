import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * MetricsModule — Issue #118
 *
 * Exposes a Prometheus-compatible `/metrics` endpoint that reports
 * rate-limit hit counters per endpoint. Intended for scraping by a
 * Prometheus server and visualisation in Grafana.
 *
 * Note: Register this module in AppModule to activate the `/api/metrics`
 * endpoint. For production, add IP-allow-list or Basic Auth in front of
 * the endpoint via a reverse-proxy rule.
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
