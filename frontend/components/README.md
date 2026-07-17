# `components/` — Reusable UI Components

## Purpose

Shared React components used across multiple pages and features. Organized into domain-specific subdirectories plus a `ui/` library of primitives.

## Conventions

- **Domain components** (e.g. `auth/`, `dashboard/`) encapsulate feature-specific UI and logic.
- **UI primitives** in `ui/` are generic, unstyled or lightly styled components built on Radix UI primitives.
- Components should be named with PascalCase filenames (e.g. `ThemeToggle.tsx`).
- Prefer composition over inheritance — keep components focused on a single responsibility.
- Export components as named exports from their files.

## Exported Signature Overview

| Subdirectory        | Description                                      |
|---------------------|--------------------------------------------------|
| `ui/`               | Base UI primitives (button, card, input, modal, etc.) |
| `auth/`             | Authentication-related forms and flows           |
| `dashboard/`        | Dashboard-specific widgets and panels            |
| `bookings/`         | Booking management UI components                 |
| `workspaces/`       | Workspace browsing and detail components         |
| `admin/`            | Admin panel components                           |
| `settings/`         | User and workspace settings UI                   |
| `notifications/`    | Notification display components                  |
| `layout/`           | Layout-level components (navbars, sidebars)      |
| `theme-provider.tsx`| Theme context provider (next-themes wrapper)     |

Each subdirectory's individual components are documented via their own exports. Refer to the component files for exact prop signatures.
