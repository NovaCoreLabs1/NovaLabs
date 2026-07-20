# `providers/` — React Context Providers

## Purpose

React context providers that wrap the application tree to inject global state, authentication, and third-party library configuration.

## Conventions

- Each provider is a self-contained component that accepts `children` and wraps them with context.
- Providers are composed in `Providers.tsx` and applied in the root layout.
- Keep providers focused on a single concern — avoid monolithic provider components.

## Exported Signature Overview

| Export              | File                    | Description                                |
|---------------------|-------------------------|--------------------------------------------|
| `Providers`         | `Providers.tsx`         | Composed provider tree for the app         |
| `ReactQueryProvider`| `ReactQueryProvider.tsx`| TanStack React Query client provider       |
| `authInitializer`   | `authInitializer.tsx`   | Hydrates auth state on app mount           |
