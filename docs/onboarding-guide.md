# Developer Onboarding Guide

Welcome to NovaLabs! This guide walks you through setting up the project on your local machine, understanding the monorepo structure, and following our development workflow.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Repository Structure](#2-repository-structure)
3. [First-Time Setup](#3-first-time-setup)
4. [Running the Project](#4-running-the-project)
5. [Running Tests](#5-running-tests)
6. [Common Development Tasks](#6-common-development-tasks)
7. [Git & Commit Convention](#7-git--commit-convention)
8. [Pull Request Process](#8-pull-request-process)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | ≥ 18.x (recommended: 20 LTS) | Required for backend & frontend |
| **npm** | ≥ 9.x | Shipped with Node.js |
| **PostgreSQL** | ≥ 14 | Database for the backend |
| **Rust toolchain** | stable | Required only for `contracts/` |

Optional but recommended:

- **Redis** — for Bull job queues and caching (backend uses it for background jobs)
- **Stellar CLI** (`stellar`) — for Soroban contract interaction

---

## 2. Repository Structure

NovaLabs is a **monorepo** with three independent subprojects:

```
NovaLabs/
├── frontend/          # Next.js 15 + Tailwind CSS v4 + TanStack Query
│   ├── app/           # App Router pages & layouts
│   ├── components/    # Reusable UI components (shadcn-style)
│   ├── lib/           # React Query hooks, store, utilities
│   ├── providers/     # React context providers
│   └── __tests__/     # Vitest test files
│
├── backend/           # NestJS 10 + TypeORM + PostgreSQL
│   ├── src/
│   │   ├── auth/      # JWT auth, 2FA, OTP
│   │   ├── users/     # User management & roles
│   │   ├── bookings/  # Workspace booking logic
│   │   ├── invoices/  # Invoice generation & PDF
│   │   ├── payments/  # Payment processing (Paystack, Soroban)
│   │   ├── email/     # Transactional email templates
│   │   └── ...        # newsletters, contact, notifications, etc.
│   ├── docs/          # Data model documentation
│   └── test/          # E2E test configuration
│
├── contracts/         # Rust smart contracts (Soroban / Stellar)
│   ├── access_control/
│   ├── manage_hub/
│   ├── workspace_booking/
│   ├── membership_token/
│   ├── payment_escrow/
│   └── resource_credits/
│
└── .github/           # CI/CD workflows, PR templates
```

Each subproject has its own `package.json` / `Cargo.toml` and dependencies — **there is no root-level `package.json`**.

---

## 3. First-Time Setup

### 3.1 Clone the Repository

```bash
git clone https://github.com/NovaCoreLabs1/NovaLabs.git
cd NovaLabs
```

### 3.2 Install Dependencies

Each subproject installs independently:

```bash
# Backend (NestJS)
cd backend
npm install
cd ..

# Frontend (Next.js)
cd frontend
npm install
cd ..

# Contracts (Rust) — only if working on smart contracts
cd contracts
cargo build --all
cd ..
```

### 3.3 Configure Environment Variables

There are no committed `.env.example` files, so create your own by copying the template below.

**Backend** — create `backend/.env`:

```bash
touch backend/.env
```

Key variables to configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `6000` |
| `NODE_ENV` | Environment mode | `development` |
| `DATABASE_HOST` | PostgreSQL host | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_USERNAME` | PostgreSQL username | `postgres` |
| `DATABASE_PASSWORD` | PostgreSQL password | `password` |
| `DATABASE_NAME` | PostgreSQL database name | `novalabs` |
| `JWT_SECRET` | Secret key for JWT signing | (generate a random string) |
| `JWT_EXPIRATION` | JWT token expiry | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token expiry | `7d` |
| `FRONTEND_URL` | Frontend base URL | `http://localhost:3000` |
| `SMTP_HOST` | SMTP server for email | (optional for dev) |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | |
| `SMTP_PASS` | SMTP password | |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary config | (optional for dev) |
| `CLOUDINARY_API_KEY` | Cloudinary config | |
| `CLOUDINARY_API_SECRET` | Cloudinary config | |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |

> **Local dev tip:** The backend tests mock external services (email, Cloudinary, Paystack), so you don't need real credentials to run the test suite.

**Frontend** — create `frontend/.env.local`:

```bash
touch frontend/.env.local
```

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:6000/api` |
| `NEXT_PUBLIC_APP_URL` | Frontend app URL | `http://localhost:3000` |

### 3.4 Set Up the Database

Make sure PostgreSQL is running, then run migrations:

```bash
cd backend

# Run pending migrations
npm run typeorm:run-migrations

# (Optional) Seed demo data
npm run demo:seed
```

---

## 4. Running the Project

You'll need **two terminal windows** — one for the backend, one for the frontend.

### Backend (API)

```bash
cd backend
npm run start:dev    # watch mode (auto-restarts on changes)
```

The API starts at **http://localhost:6000**.  
Swagger docs are available at **http://localhost:6000/swagger**.

### Frontend (UI)

```bash
cd frontend
npm run dev          # Next.js dev server with Turbopack
```

The UI starts at **http://localhost:3000**.

### Contracts (Rust) — Optional

```bash
cd contracts
cargo build --all    # Build all Soroban contracts
cargo test --all     # Run contract tests
```

---

## 5. Running Tests

### Backend (Jest)

```bash
cd backend

npm test          # Run all unit tests
npm run test:cov  # Run with coverage report
npm run test:e2e  # Run end-to-end tests
```

**Coverage target:** ≥ 80%

### Frontend (Vitest)

```bash
cd frontend

npm test            # Run all tests
npm run test:watch  # Watch mode
npm run test:cov    # Run with coverage report
```

**Coverage target:** ≥ 20%

### Contracts (Rust / cargo)

```bash
cd contracts

cargo test --all              # Run all contract tests
cargo tarpaulin --all         # Coverage (requires cargo-tarpaulin)
```

**Coverage target:** ≥ 80% per crate

---

## 6. Common Development Tasks

### Database Migrations

```bash
cd backend

# Generate a new migration from entity changes
npm run typeorm:generate-migration --name=MigrationName

# Create a blank migration
npm run typeorm:create-migration --name=MigrationName

# Apply pending migrations
npm run typeorm:run-migrations

# Revert the last migration
npm run typeorm:revert-migration
```

### Regenerate ER Diagram

After changing entities, regenerate the data model documentation:

```bash
cd backend
npm run db:diagram
```

This runs `erdia` and outputs to `backend/docs/erd/`. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the data-model sync rule.

### Linting & Formatting

```bash
# Backend
cd backend && npm run lint

# Frontend
cd frontend && npm run lint
```

### Demo Data

```bash
cd backend

npm run demo:seed   # Seed demo data into the database
npm run demo:clear  # Clear all demo data
npm run demo:info   # Show info about seeded data
```

---

## 7. Git & Commit Convention

This project uses **Conventional Commits** enforced by CommitLint.

### Allowed Commit Types

| Type | Usage |
|------|-------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation-only changes |
| `style` | Code style / formatting (no logic change) |
| `refactor` | Code restructuring (no feature/bug change) |
| `test` | Adding or updating tests |
| `chore` | Build tooling, CI, maintenance |
| `ci` | CI/CD configuration changes |

### Commit Format

```
type(scope): short description

Optional longer body explaining the change.
```

**Examples:**

```
feat(auth): add 2FA setup endpoint
fix(bookings): handle overlapping booking validation
test(users): add unit tests for member queries
chore(deps): upgrade next.js to 15.5.9
```

---

## 8. Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** and commit using the conventional format.

3. **Run the PR checklist** before pushing:
   ```bash
   cd backend && npm run lint && npm run build
   cd frontend && npm run lint && npm run build
   ```

4. **Push your branch** and open a PR:
   ```bash
   git push origin feat/your-feature-name
   ```

5. **Fill out the PR template** — include the linked issue, description, and test plan.

6. **Wait for CI** — the pipeline runs:
   - Format check (contracts)
   - Clippy lint (contracts)
   - Backend lint, build, unit tests, coverage
   - Frontend lint, tests, coverage, build
   - Contract tests & coverage
   - Data model sync check
   - ER diagram generation check

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full contribution checklist and coding conventions.

---

## 9. Troubleshooting

### "Module not found" errors

Ensure you installed dependencies in the correct subdirectory:

```bash
cd backend && npm install
cd frontend && npm install
```

### "Connection refused" for PostgreSQL

Make sure PostgreSQL is running and the credentials in `backend/.env` are correct:

```bash
# Check if PostgreSQL is listening
pg_isready -h localhost -p 5432
```

### "JWT_SECRET is not set"

Add a random secret to `backend/.env`:

```
JWT_SECRET=your-random-secret-here
```

You can generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "cache-manager" or "redis" errors

Redis is optional for basic development, but some background-job features (Bull queues) require it. If Redis isn't available, you can:

- Disable Bull module registration in the relevant NestJS modules
- Or install and start Redis locally:
  ```bash
  # macOS
  brew install redis && brew services start redis
  # Linux
  sudo apt install redis-server && sudo systemctl start redis
  ```

### Tests fail with "SMTP connection failed"

Email tests expect SMTP. If you don't have an SMTP server configured:

- The email service gracefully handles this in dev mode (it logs a warning)
- Set `SMTP_HOST` and `SMTP_PORT` to dummy values in `.env` to silence warnings:
  ```
  SMTP_HOST=localhost
  SMTP_PORT=1025
  ```

---

## Need Help?

- Open an issue on [GitHub](https://github.com/NovaCoreLabs1/NovaLabs/issues)
- Check the [README](../README.md) for a project overview
- Review [CONTRIBUTING.md](../CONTRIBUTING.md) for coding conventions
- See the [Data Model](../backend/docs/data-model.md) for PostgreSQL schema documentation
