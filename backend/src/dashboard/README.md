# `dashboard/`

Analytics and dashboard aggregation module.

## Purpose

Aggregates business metrics for the admin dashboard and member dashboard:
revenue trends, occupancy rates, booking volumes, member growth, and
workspace utilization.

## Key Entities

- **AdminAnalyticsProvider** — revenue, occupancy, and member metrics for
  admin dashboards.
- **MemberDashboardProvider** — personalized booking history, payment
  summary, and upcoming reservations.

## Endpoints

| Method | Path                        | Auth  | Description                    |
| ------ | --------------------------- | ----- | ------------------------------ |
| GET    | `/dashboard/admin`          | Admin | Aggregated business metrics    |
| GET    | `/dashboard/member`         | JWT   | Personalized member metrics    |

## Key Files

| File                                     | Role                           |
| ---------------------------------------- | ------------------------------ |
| `dashboard.module.ts`                    | NestJS module registration     |
| `dashboard.controller.ts`                | HTTP endpoints                 |
| `dashboard.service.ts`                   | Orchestration layer            |
| `providers/admin-analytics.provider.ts`  | Admin metrics aggregation      |
| `providers/member-dashboard.provider.ts` | Member metrics aggregation     |
| `dto/analytics-query.dto.ts`            | Date-range query params        |
