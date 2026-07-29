# `payments/`

Payment processing module integrating Paystack and Stellar Soroban.

## Purpose

Handles payment initialization, Paystack webhook verification, Soroban escrow
management, refund processing, and payment record queries.

## Key Entities

- **Payment** (`entities/payment.entity.ts`) — records payment attempts with
  provider reference, amount (kobo), status, and linkage to bookings/users.

## Providers

| Provider                                      | Role                              |
| --------------------------------------------- | --------------------------------- |
| `paystack.provider.ts`                        | Paystack API integration          |
| `initialize-payment.provider.ts`              | Payment initialization flow       |
| `handle-webhook.provider.ts`                  | Paystack webhook processing       |
| `soroban-escrow.provider.ts`                  | Stellar Soroban escrow management |
| `refund-payment.provider.ts`                  | Refund orchestration              |
| `find-payments.provider.ts`                   | Payment record queries            |
| `fake-soroban-rpc.client.ts`                  | Test double for Soroban RPC       |
| `real-soroban-rpc.client.ts`                  | Production Soroban RPC client     |
| `soroban-rpc-client.interface.ts`             | RPC client interface (DI token)   |

## Endpoints

| Method | Path                       | Description                  |
| ------ | -------------------------- | ---------------------------- |
| POST   | `/payments/initialize`     | Initialize a payment          |
| POST   | `/payments/webhook`        | Paystack webhook callback     |
| POST   | `/payments/:id/refund`     | Initiate a refund             |
| GET    | `/payments`                | List payments (admin)         |
| GET    | `/payments/me`             | List own payments             |

## Key Files

| File                                         | Role                              |
| -------------------------------------------- | --------------------------------- |
| `payments.module.ts`                         | NestJS module registration        |
| `payments.controller.ts`                     | HTTP endpoints                    |
| `payments.service.ts`                        | Orchestration layer               |
| `providers/paystack.provider.ts`             | Paystack HTTP client              |
| `providers/soroban-escrow.provider.ts`       | Soroban smart contract integration|
| `providers/soroban-escrow.provider.spec.ts`  | Unit tests                        |
| `providers/handle-webhook.provider.spec.ts`  | Webhook tests                     |
| `enums/payment-status.enum.ts`               | Status enum                       |
| `enums/payment-provider.enum.ts`             | Provider enum                     |
