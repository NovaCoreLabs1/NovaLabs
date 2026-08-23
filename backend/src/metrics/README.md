# `metrics/`

Prometheus-compatible application metrics module.

## Purpose

Exposes `GET /api/metrics` for Prometheus scraping with process default
metrics plus application counters (`novalabs_rate_limited_total`,
`novalabs_http_requests_total`, `novalabs_active_connections`).

## Auth

The route is `@Public()` only so the global `JwtAuthGuard` does not 401 a
scraper that has no NovaLabs JWT. `MetricsAuthGuard` then requires **one**
of:

1. `Authorization: Bearer <METRICS_SCRAPE_TOKEN>` (Prometheus
   `bearer_token` / `bearer_token_file`). Alias: `METRICS_TOKEN`.
2. A valid access JWT whose role is `admin` or `super_admin`.

Unauthenticated requests and regular `USER` JWTs are rejected. If the
scrape token is unset **and** `JWT_SECRET` is missing, the endpoint fails
closed (401). A reverse-proxy IP allow-list is a valid extra control; it
is not implemented here. See `docs/SECRETS.md` for rotation and a sample
Prometheus job.

## Endpoints

| Method | Path           | Auth                                      | Description                      |
| ------ | -------------- | ----------------------------------------- | -------------------------------- |
| GET    | `/api/metrics` | Scrape token **or** admin / super_admin JWT | Prometheus-format metrics export |

## Key Files

| File                     | Role                                 |
| ------------------------ | ------------------------------------ |
| `metrics.module.ts`      | NestJS module registration           |
| `metrics.controller.ts`  | Metrics endpoint                     |
| `metrics-auth.guard.ts`  | Scrape-token / admin-JWT gate        |
| `metrics.service.ts`     | Metric registration logic            |
