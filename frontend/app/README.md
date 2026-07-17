# `app/` — Next.js App Router Pages

## Purpose

Contains all route-based page components and layouts for the frontend, organized by feature. Each subdirectory corresponds to a route segment under the App Router convention.

## Conventions

- Route groups (e.g. `(auth)/`) wrap related routes without affecting the URL path.
- Each route directory contains a `page.tsx` as the entry point; shared layouts go in `layout.tsx`.
- Loading states live in `loading.tsx`; error boundaries in `error.tsx`.
- Keep page components thin — delegate UI logic to `components/` and data fetching to `lib/`.

## Exported Signature Overview

| Export             | File             | Description                          |
|--------------------|------------------|--------------------------------------|
| `layout` (default) | `layout.tsx`     | Root layout with providers & styles  |
| `page` (default)   | `page.tsx`       | Home page                            |
| `error` (default)  | `error.tsx`      | Global error boundary                |
| `loading` (default)| `loading.tsx`    | Global loading fallback              |
| `not-found`        | `not-found.tsx`  | Custom 404 page                      |

Sub-route pages follow the same `page.tsx` convention inside their respective directories.
