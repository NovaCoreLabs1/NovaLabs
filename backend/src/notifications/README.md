# `notifications/`

Real-time notification delivery module via WebSocket.

## Purpose

Delivers in-app notifications (booking confirmations, payment receipts, system
announcements) via Socket.IO WebSocket gateway and persists them for retrieval.

## Key Entities

- **Notification** (`entities/notification.entity.ts`) — a persisted
  notification with type, title, body, recipient, and read status.

## Notification Types

| Type                    | Trigger                                   |
| ----------------------- | ----------------------------------------- |
| `BOOKING_CONFIRMED`     | Booking confirmed by admin                |
| `BOOKING_CANCELLED`     | Booking cancelled                         |
| `PAYMENT_RECEIVED`      | Payment confirmed via webhook             |
| `INVOICE_READY`         | Invoice generated and available           |
| `SYSTEM_ANNOUNCEMENT`   | Admin broadcast                           |

## Key Files

| File                                        | Role                           |
| ------------------------------------------- | ------------------------------ |
| `notifications.module.ts`                   | NestJS module registration     |
| `notifications.controller.ts`               | HTTP REST endpoints            |
| `notifications.service.ts`                  | Orchestration layer            |
| `gateway/notifications.gateway.ts`          | Socket.IO WebSocket gateway    |
| `providers/create-notification.provider.ts` | Notification creation          |
| `providers/find-notifications.provider.ts`  | Notification queries           |
| `entities/notification.entity.ts`           | TypeORM entity                 |
| `dto/notification-query.dto.ts`             | Query filter DTO               |
| `enums/notification-type.enum.ts`           | Notification type enum         |
