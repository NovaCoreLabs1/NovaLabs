# `utils/` — Pure Utility Functions

## Purpose

Small, pure utility functions used across the frontend. These have no React dependencies and no side effects.

## Conventions

- Functions must be pure (deterministic output for same input, no side effects).
- One file per utility concern.
- If a utility grows beyond a few functions or becomes domain-specific, consider moving it to `lib/`.

## Exported Signature Overview

| Export   | File     | Description                                    |
|----------|----------|------------------------------------------------|
| `cn`     | `cn.ts`  | Tailwind class merging utility (clsx + tailwind-merge) |
| `env`    | `env.ts` | Type-safe environment variable access           |
