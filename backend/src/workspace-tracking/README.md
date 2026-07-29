# `workspace-tracking/`

Real-time workspace occupancy and check-in module.

## Purpose

Tracks member check-ins/check-outs for workspaces and exposes current occupancy
data. Used by the dashboard and admin panels to display live seat availability.

## Key Entities

- **WorkspaceLog** (`entities/workspace-log.entity.ts`) — immutable log of every
  check-in/check-out event, linked to a User and Workspace.

## Endpoints

| Method | Path                           | Description                     |
| ------ | ------------------------------ | ------------------------------- |
| POST   | `/workspace-tracking/check-in` | Record a member check-in        |
| GET    | `/workspace-tracking/occupancy`| Current occupancy for workspace |

## Key Files

| File                                      | Role                           |
| ----------------------------------------- | ------------------------------ |
| `workspace-tracking.module.ts`            | NestJS module registration     |
| `workspace-tracking.controller.ts`        | HTTP endpoints                 |
| `workspace-tracking.service.ts`           | Orchestration layer            |
| `providers/check-in.provider.ts`          | Check-in business logic        |
| `providers/occupancy.provider.ts`         | Occupancy aggregation           |
| `providers/check-in.provider.spec.ts`     | Unit tests                     |
| `entities/workspace-log.entity.ts`        | TypeORM entity                 |
| `dto/check-in.dto.ts`                    | Request validation             |
| `dto/occupancy-query.dto.ts`             | Occupancy query params          |
