import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * MetricsService — Issue #118
 *
 * Manages the Prometheus metric registry and exposes counters for:
 *  - `novalabs_rate_limited_total`  — rate-limit rejections per endpoint
 *  - `novalabs_http_requests_total` — total HTTP requests per method/route/status
 *
 * Use `MetricsService.recordRateLimit(endpoint)` in your ThrottlerGuard
 * override or exception filter to increment the counter.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry: Registry;

  /** Counter: rate-limit hits labelled by endpoint path */
  readonly rateLimitedTotal: Counter<string>;

  /** Counter: total HTTP requests labelled by method, route, and status code */
  readonly httpRequestsTotal: Counter<string>;

  /** Gauge: currently active connections */
  readonly activeConnections: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
      prefix: 'novalabs_',
    });

    this.rateLimitedTotal = new Counter({
      name: 'novalabs_rate_limited_total',
      help: 'Total number of requests rejected by the rate limiter, labelled by endpoint',
      labelNames: ['endpoint', 'method'],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new Counter({
      name: 'novalabs_http_requests_total',
      help: 'Total HTTP requests handled, labelled by method, route, and status code',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.activeConnections = new Gauge({
      name: 'novalabs_active_connections',
      help: 'Number of currently active HTTP connections',
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Registry is initialised in the constructor; nothing extra needed here.
  }

  /**
   * Increment the rate-limit counter for a given endpoint.
   * Call this wherever a 429 Too Many Requests response is sent.
   *
   * @param endpoint - The route path (e.g. `/api/auth/login`)
   * @param method   - HTTP method (e.g. `POST`)
   */
  recordRateLimit(endpoint: string, method = 'UNKNOWN'): void {
    this.rateLimitedTotal.inc({ endpoint, method });
  }

  /**
   * Increment the HTTP requests counter.
   *
   * @param method     - HTTP method
   * @param route      - Matched route pattern (e.g. `/api/users/:id`)
   * @param statusCode - Response status code as a string
   */
  recordHttpRequest(method: string, route: string, statusCode: string): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
  }

  /** Serialise all metrics in the Prometheus text exposition format. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Returns the content-type expected by Prometheus scrapers. */
  getContentType(): string {
    return this.registry.contentType;
  }
}
