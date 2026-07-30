# `bookings/`

Workspace booking lifecycle module — the core revenue path.

## Purpose

Manages the full booking lifecycle: creation (authenticated and public day
pass), confirmation, cancellation, completion, listing, and pricing
estimation. Integrates with payments and email modules.

## Key Entities

- **Booking** (`entities/booking.entity.ts`) — a reservation linking a User
  (or guest) to a Workspace with a plan type, date range, seat count, total
  amount (kobo), status, and optional Soroban escrow ID.

## Booking Statuses

| Status      | Description                                   |
| ----------- | --------------------------------------------- |
| `PENDING`   | Created, awaiting payment and/or confirmation |
| `CONFIRMED` | Payment verified and booking confirmed        |
| `CANCELLED` | Cancelled by user or admin                    |
| `COMPLETED` | Booking period has ended                      |

## Plan Types

| Plan        | Typical duration    |
| ----------- | ------------------- |
| `DAY_PASS`  | Single day          |
| `WEEKLY`    | 7 days              |
| `MONTHLY`   | 30 days             |
| `QUARTERLY` | 90 days             |
| `YEARLY`    | 365 days            |

## Endpoints

| Method | Path                              | Auth         | Description                     |
| ------ | --------------------------------- | ------------ | ------------------------------- |
| POST   | `/bookings`                       | JWT          | Create a booking                |
| POST   | `/bookings/public/day-pass`       | Public       | Guest day-pass booking          |
| GET    | `/bookings`                       | JWT          | List own bookings (all for admin)|
| GET    | `/bookings/price-estimate`        | Public       | Get price estimate              |
| GET    | `/bookings/:id`                   | JWT          | Get booking details             |
| PATCH  | `/bookings/:id/confirm`           | Admin/Staff  | Confirm a booking               |
| PATCH  | `/bookings/:id/cancel`            | JWT          | Cancel a booking                |
| PATCH  | `/bookings/:id/complete`          | Admin/Staff  | Mark booking as completed       |

## Key Files

| File                                           | Role                                |
| ---------------------------------------------- | ----------------------------------- |
| `bookings.module.ts`                           | NestJS module registration          |
| `bookings.controller.ts`                       | HTTP endpoints                      |
| `bookings.service.ts`                          | Orchestration layer                 |
| `entities/booking.entity.ts`                   | TypeORM entity                      |
| `providers/create-booking.provider.ts`         | Authenticated booking creation      |
| `providers/create-public-day-pass.provider.ts` | Guest day-pass creation             |
| `providers/confirm-booking.provider.ts`        | Booking confirmation                |
| `providers/cancel-booking.provider.ts`         | Booking cancellation                |
| `providers/complete-booking.provider.ts`       | Booking completion                  |
| `providers/find-bookings.provider.ts`          | Booking queries                     |
| `pricing/pricing.service.ts`                   | Price calculation                   |
| `dto/create-booking.dto.ts`                    | Create validation                   |
| `dto/create-public-booking.dto.ts`             | Public booking validation           |
| `dto/booking-query.dto.ts`                     | Query filtering                     |
| `enums/plan-type.enum.ts`                      | Plan type enum                      |
| `enums/booking-status.enum.ts`                 | Status enum                         |
