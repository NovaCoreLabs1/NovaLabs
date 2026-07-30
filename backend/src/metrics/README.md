# `metrics/`

Prometheus-compatible application metrics module.

## Purpose

Exposes a `/metrics` endpoint for Prometheus scraping with built-in HTTP
request metrics (duration, count, status codes) and custom business metrics
(booking rates, payment volumes, auth events).

## Endpoints

| Method | Path       | Auth   | Description                      |
| ------ | ---------- | ------ | -------------------------------- |
| GET    | `/metrics` | Admin  | Prometheus-format metrics export |

## Key Files

| File                  | Role                           |
| --------------------- | ------------------------------ |
| `metrics.module.ts`   | NestJS module registration     |
| `metrics.controller.ts`| Metrics endpoint               |
| `metrics.service.ts`  | Metric registration logic      |
