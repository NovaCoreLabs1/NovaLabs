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

  /** Counter: email jobs accepted onto the durable queue, by template */
  readonly emailEnqueued: Counter<string>;

  /** Counter: enqueue failures (queue unavailable) for critical emails */
  readonly emailEnqueueFailures: Counter<string>;

  /** Counter: SMTP deliveries that exhausted all retries and hit the DLQ */
  readonly emailDeadLettered: Counter<string>;

  /** Counter: on-chain escrow operations that failed after submission, by operation */
  readonly sorobanEscrowFailures: Counter<string>;

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

    this.emailEnqueued = new Counter({
      name: 'novalabs_email_enqueued_total',
      help: 'Email jobs accepted onto the durable queue, labelled by template/subject kind',
      labelNames: ['kind'],
      registers: [this.registry],
    });

    this.emailEnqueueFailures = new Counter({
      name: 'novalabs_email_enqueue_failures_total',
      help: 'Enqueue attempts that failed because the queue was unavailable',
      labelNames: ['kind'],
      registers: [this.registry],
    });

    this.emailDeadLettered = new Counter({
      name: 'novalabs_email_dead_lettered_total',
      help: 'Email jobs moved to the dead-letter queue after exhausting retries, labelled by kind',
      labelNames: ['kind'],
      registers: [this.registry],
    });

    this.sorobanEscrowFailures = new Counter({
      name: 'novalabs_soroban_escrow_failures_total',
      help: 'Failed on-chain escrow operations (issue #227), labelled by contract function',
      labelNames: ['operation'],
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

  /**
   * Increment the failed escrow counter for a contract function.
   * Call this wherever an escrow operation fails and the failure is
   * deliberately not allowed to abort the surrounding flow.
   *
   * @param operation - Contract function name (e.g. `create_escrow`)
   */
  recordSorobanEscrowFailure(operation: string): void {
    this.sorobanEscrowFailures.inc({ operation });
  }

  /** Returns the content-type expected by Prometheus scrapers. */
  getContentType(): string {
    return this.registry.contentType;
  }
}
