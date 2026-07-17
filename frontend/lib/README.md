# `lib/` — Shared Utilities, Hooks, Store & Types

## Purpose

Core application logic that is shared across features — API client, data fetching hooks, state management, validation schemas, TypeScript types, and utility functions.

## Conventions

- **Data fetching** via TanStack React Query: query/mutation hooks live in `react-query/hooks/`, query keys in `react-query/keys/`.
- **State management** using Zustand stores in `store/`.
- **Validation schemas** (Zod) in `schemas/`, one file per domain entity.
- **TypeScript types** in `types/`, mirroring the backend API response shapes.
- **Shared hooks** that aren't query-specific go in `hooks/` (e.g. `useAuthRedirect`, `useErrorHandler`).
- Keep modules pure and side-effect free where possible; side effects belong in hooks or components.

## Exported Signature Overview

| Path                | Description                                      |
|---------------------|--------------------------------------------------|
| `apiClient.ts`      | Axios/fetch-based API client with auth interceptor |
| `seo.ts`            | SEO metadata helpers                             |
| `storage.ts`        | Local storage wrapper                            |
| `utils.ts`          | General-purpose utility functions                |
| `react-query/hooks/`| TanStack Query hooks per domain                  |
| `react-query/keys/` | Query key factories for cache management         |
| `store/`            | Zustand stores (auth, UI state, etc.)            |
| `schemas/`          | Zod validation schemas (login, register, etc.)   |
| `types/`            | TypeScript interfaces and types                  |
| `hooks/`            | Shared custom hooks (auth, redirect, error)      |

Refer to individual files for exact function signatures and exported members.
