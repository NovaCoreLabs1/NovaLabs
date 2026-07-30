# `workspaces/`

Workspace catalog and management module.

## Purpose

CRUD for coworking spaces — creation, discovery, availability checking,
updates, and soft-deletion. Workspaces are the inventory that users browse and
book.

## Key Entities

- **Workspace** (`entities/workspace.entity.ts`) — a physical coworking space
  with name, type (HOT_DESK, DEDICATED_DESK, PRIVATE_OFFICE, MEETING_ROOM),
  hourly rate, capacity, amenities, and address.

## Endpoints

| Method | Path                          | Description                        |
| ------ | ----------------------------- | ---------------------------------- |
| GET    | `/workspaces`                 | List/filter available workspaces   |
| GET    | `/workspaces/:id`             | Get workspace details              |
| GET    | `/workspaces/:id/availability`| Check date-range availability      |
| POST   | `/workspaces`                 | Create workspace (Admin)           |
| PATCH  | `/workspaces/:id`             | Update workspace (Admin)           |
| DELETE | `/workspaces/:id`             | Soft-delete workspace (Admin)      |

## Key Files

| File                                              | Role                          |
| ------------------------------------------------- | ----------------------------- |
| `workspaces.module.ts`                            | NestJS module registration    |
| `workspaces.controller.ts`                        | HTTP endpoints                |
| `workspaces.service.ts`                           | Orchestration layer           |
| `entities/workspace.entity.ts`                    | TypeORM entity                |
| `providers/create-workspace.provider.ts`          | Creation logic                |
| `providers/find-all-workspaces.provider.ts`       | List/filter logic             |
| `providers/find-workspace-by-id.provider.ts`      | Single lookup                 |
| `providers/update-workspace.provider.ts`          | Update logic                  |
| `providers/delete-workspace.provider.ts`          | Soft-delete logic             |
| `providers/check-workspace-availability.provider.ts` | Availability checking       |
| `dto/create-workspace.dto.ts`                    | Create validation             |
| `dto/update-workspace.dto.ts`                    | Update validation             |
| `dto/workspace-query.dto.ts`                     | Query filtering               |
| `enums/workspace-type.enum.ts`                   | Workspace type enum           |
