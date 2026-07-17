# `hooks/` — Top-Level Custom Hooks

## Purpose

Standalone custom React hooks that don't belong to a specific domain or are used app-wide.

## Conventions

- Hooks follow the `use-<name>.ts` naming convention.
- Prefer placing domain-specific hooks in `lib/hooks/` or `lib/react-query/hooks/` — this directory is for cross-cutting hooks only.

## Exported Signature Overview

| Export       | File           | Description                     |
|--------------|----------------|---------------------------------|
| `useLogin`   | `use-login.ts` | Login form state & submission   |
