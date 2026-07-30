# `invoices/`

Invoice generation, retrieval, and PDF export module.

## Purpose

Generates invoices for confirmed bookings, assigns sequential invoice numbers,
renders downloadable PDFs, and supports querying by booking, user, or date range.

## Key Entities

- **Invoice** (`entities/invoice.entity.ts`) — a billing document linked to a
  booking with a unique sequential invoice number, status, line items, and
  optional PDF download path.

## Invoice Statuses

| Status      | Description                              |
| ----------- | ---------------------------------------- |
| `PENDING`   | Generated but not yet paid               |
| `PAID`      | Payment confirmed                        |
| `CANCELLED` | Booking cancelled, invoice voided        |
| `OVERDUE`   | Past due date without payment            |

## Endpoints

| Method | Path                          | Auth        | Description                  |
| ------ | ----------------------------- | ----------- | ---------------------------- |
| GET    | `/invoices`                   | Admin       | List all invoices            |
| GET    | `/invoices/me`                | JWT         | List own invoices            |
| GET    | `/invoices/:id`               | JWT         | Get invoice details          |
| GET    | `/invoices/:id/download`      | JWT         | Download invoice PDF         |

## Key Files

| File                                  | Role                              |
| ------------------------------------- | --------------------------------- |
| `invoices.module.ts`                  | NestJS module registration        |
| `invoices.controller.ts`              | HTTP endpoints                    |
| `invoices.service.ts`                 | Orchestration layer               |
| `providers/generate-invoice.provider.ts` | Invoice creation logic          |
| `providers/find-invoices.provider.ts` | Invoice query logic               |
| `providers/pdf-invoice.provider.ts`   | PDF generation                    |
| `providers/invoice-sequence.provider.ts` | Sequential numbering           |
| `entities/invoice.entity.ts`          | TypeORM entity                    |
| `dto/invoice-query.dto.ts`            | Query filter DTO                  |
| `enums/invoice-status.enum.ts`        | Status enum                       |
