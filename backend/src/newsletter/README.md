# `newsletter/`

Email newsletter subscription management module.

## Purpose

Manages newsletter subscriptions (subscribe, confirm, unsubscribe) and
provides admin endpoints for subscriber list management and bulk exports.

## Key Entities

- **Newsletter** (`entities/newsletter.entity.ts`) — a subscriber record
  with email, subscription status, confirmation token, and timestamps.

## Endpoints

| Method | Path                           | Auth   | Description                      |
| ------ | ------------------------------ | ------ | -------------------------------- |
| POST   | `/newsletter/subscribe`        | Public | Subscribe to newsletter          |
| GET    | `/newsletter/confirm?token=`   | Public | Confirm subscription via token   |
| POST   | `/newsletter/unsubscribe`      | Public | Unsubscribe                      |
| GET    | `/newsletter/subscribers`      | Admin  | List all subscribers             |

## Key Files

| File                                    | Role                           |
| --------------------------------------- | ------------------------------ |
| `newsletter.module.ts`                  | NestJS module registration     |
| `newsletter.controller.ts`              | HTTP endpoints                 |
| `newsletter.service.ts`                 | Orchestration layer            |
| `providers/subscription.provider.ts`    | Subscribe/unsubscribe logic    |
| `providers/list-subscribers.provider.ts`| Admin subscriber listing       |
| `entities/newsletter.entity.ts`         | TypeORM entity                 |
| `dto/subscription.dto.ts`              | Subscription validation        |
| `dto/admin-fetch.dto.ts`               | Admin query params             |
