import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { ApiExcludeController } from '@nestjs/swagger';

/**
 * MetricsController — Issue #118
 *
 * Exposes `GET /api/metrics` in Prometheus text-format.
 * Scrape interval recommendation: 15–30 seconds.
 *
 * ⚠️  Restrict access to this endpoint in production:
 *     - Add an IP allow-list in your reverse-proxy config, OR
 *     - Use HTTP Basic Auth / bearer token middleware in front.
 */
@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * GET /api/metrics
   *
   * Returns all registered Prometheus metrics in the standard text
   * exposition format. Prometheus scrapers expect this exact content-type.
   */
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    const contentType = this.metricsService.getContentType();

    res.set('Content-Type', contentType);
    res.send(metrics);
  }
}
