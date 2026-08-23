import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiExcludeController } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { MetricsAuthGuard } from './metrics-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * MetricsController — Issue #118 / scraper auth
 *
 * Exposes `GET /api/metrics` in Prometheus text-format
 * (`text/plain; version=0.0.4`). Scrape interval recommendation: 15–30s.
 *
 * Authentication (see `MetricsAuthGuard` and `docs/SECRETS.md`):
 *   - Prometheus scrapers present `Authorization: Bearer <METRICS_SCRAPE_TOKEN>`
 *     (`bearer_token` / `bearer_token_file` on the scrape job).
 *   - Human operators may use an admin / super_admin JWT instead.
 *   - Unauthenticated requests and regular USER JWTs are rejected.
 *   - If both the scrape token and JWT secret are unset, the endpoint
 *     fails closed (401) — it is never anonymously public.
 *
 * `@Public()` only skips the global `JwtAuthGuard` so scrapers are not
 * 401'd before this controller's own guard runs. CSRF does not apply
 * (GET is not state-changing). The tenant interceptor still runs but is
 * a no-op for scrapers (no `req.user` / `x-hub-id` → hub `default`).
 *
 * A reverse-proxy IP allow-list is a valid extra control; it is not
 * implemented in this repo.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@UseGuards(MetricsAuthGuard)
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

    res.setHeader('Content-Type', contentType);
    res.status(200).end(metrics);
  }
}
