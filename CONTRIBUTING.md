# Contributing to NovaLabs

👋 Thanks for your interest in contributing to **NovaLabs** — the modern
full-stack coworking & workspace management platform.

This guide walks you through everything you need to know to make a
high-quality contribution: how to set up the project locally, how to write
good commits and PRs, how to run the test suite, and how to extend the
backend, frontend and on-chain contracts.

> 📌 **First time here?** Look for issues labeled
> [`good first issue`](https://github.com/NovaCoreLabs1/NovaLabs/issues?q=is%3Aopen+label%3A%22good-first-issue%22)
> — they're scoped, well documented and welcoming.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Reporting Bugs & Requesting Features](#reporting-bugs--requesting-features)
3. [Security Disclosures](#security-disclosures)
4. [Development Setup](#development-setup)
   - [Prerequisites](#prerequisites)
   - [Quick Start](#quick-start)
   - [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
   - [Branching](#branching)
   - [Commits (Conventional Commits)](#commits-conventional-commits)
   - [Pre-commit Checklist](#pre-commit-checklist)
6. [Backend (NestJS)](#backend-nestjs)
   - [Code Style](#code-style)
   - [Module Architecture](#module-architecture)
   - [Adding a New Module](#adding-a-new-module)
   - [OpenTelemetry / Tracing](#opentelemetry--tracing)
7. [Frontend (Next.js)](#frontend-nextjs)
   - [Code Style](#frontend-code-style)
   - [Component Conventions](#component-conventions)
8. [Smart Contracts (Rust / Stellar)](#smart-contracts-rust--stellar)
9. [Docker / Deployment](#docker--deployment)
   - [Hardened Backend Image](#hardened-backend-image)
   - [Environment Variables in Containers](#environment-variables-in-containers)
10. [Testing](#testing)
    - [Backend — Jest & Stryker](#backend--jest--stryker)
    - [Frontend — ESLint](#frontend--eslint)
    - [Contracts — Cargo](#contracts--cargo)
11. [Pull Request Process](#pull-request-process)
12. [Issue Labels (Triage Guide)](#issue-labels-triage-guide)
13. [Maintainers & Contact](#maintainers--contact)

---

## Code of Conduct

All participants are expected to follow the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md), which is adapted from the
[Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct.html).
Be kind. Be patient. Assume good faith.

---

## Reporting Bugs & Requesting Features

* **Bugs** — Use the
  [`bug_report.yml`](.github/ISSUE_TEMPLATE/bug_report.yml) template and
  include reproduction steps, expected vs actual behaviour, screenshots and
  environment details.
* **Features** — Use the
  [`feature_request.yml`](.github/ISSUE_TEMPLATE/feature_request.yml)
  template and describe the user story and acceptance criteria.
* **Documentation fixes** — Use the
  [`doc_fix.yml`](.github/ISSUE_TEMPLATE/doc_fix.yml) template.
* **Smart-contract audits** — Use the
  [`contract_audit.yml`](.github/ISSUE_TEMPLATE/contract_audit.yml)
  template when reporting findings on `contracts/`.

---

## Security Disclosures

🚨 **Do NOT open public issues for security vulnerabilities.**

Please follow the disclosure process in
[`SECURITY.md`](SECURITY.md) — open a private GitHub Security Advisory via
the **Security** tab. See the [onboarding guide](docs/onboarding-guide.md)
for context on our threat model
([`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md)).

---

## Development Setup

### Prerequisites

* **Node.js ≥ 20.x** (the CI matrix installs Node 20)
* **npm ≥ 10.x** (or `pnpm`/`yarn` — CI uses `npm`)
* **PostgreSQL ≥ 14** (local or hosted, e.g. Neon)
* **Redis ≥ 6** (for jobs, queues & throttler state)
* **Rust toolchain (stable)** with `wasm32-unknown-unknown` target — only
  required if you intend to build `contracts/`
* **Docker ≥ 24** — optional, only needed for containerised testing

> 🪟 On Windows, use WSL2. macOS / Linux Docker Desktop both work.

### Quick Start

```bash
# 1. Fork & clone
git clone https://github.com/<your-username>/NovaLabs.git
cd NovaLabs

# 2. Configure environment
cp backend/.env.example backend/.env   # fill in DATABASE_*, REDIS_*, JWT_SECRET, SMTP_*

# 3. Install dependencies
(cd backend  && npm install)
(cd frontend && npm install)

# 4. Build shared schema (TypeORM)
(cd backend && npm run typeorm:run-migrations)   # optional — `synchronize:true` in dev

# 5. Run dev servers in two terminals
(cd backend  && npm run start:dev)   # http://localhost:3000/api
(cd frontend && npm run dev)         # http://localhost:3000
```

A complete end-to-end dev environment walkthrough lives in
[`docs/onboarding-guide.md`](docs/onboarding-guide.md).

### Project Structure

```
NovaLabs/
├── backend/         # NestJS API (Node 20, Postgres, Redis, Bull)
├── frontend/        # Next.js 15 (App Router, Turbopack, React 19)
├── contracts/       # Rust → WASM smart contracts (Stellar)
├── docs/            # Onboarding guide, threat model
├── .github/         # Issue templates, CI workflows, CODEOWNERS
├── Dockerfile       # Hardened production image for backend
├── docker-compose.yml (optional, see Docker section)
└── README.md
```

---

## Development Workflow

### Branching

Branches should follow one of these prefixes so CI and reviewers can route
your PR correctly:

| Prefix       | Purpose                                |
|--------------|----------------------------------------|
| `feat/`      | New user-facing feature                |
| `fix/`       | Bug fix                                |
| `docs/`      | Documentation only                     |
| `refactor/`  | Code restructuring, no behaviour change|
| `test/`      | Adding or improving tests              |
| `chore/`     | Tooling, CI, infra                     |
| `security/`  | Security hardening                     |

Always branch from `main` and keep your branch current — `git rebase main`
before requesting review.

### Commits (Conventional Commits)

This repository uses **Conventional Commits**, enforced by
[`commitlint.config.js`](commitlint.config.js). Allowed types are:

`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`.

```
feat(bookings): add seat-reservation conflict detection
fix(auth): prevent race condition in JWT refresh
docs(contributing): clarify migration workflow
chore(deps): bump @nestjs/core to ^10.4.0
```

A scope is encouraged (`backend`, `frontend`, `contracts`, `ci`, `docs`).
Breaking changes must include a `!` after the type/scope and a `BREAKING
CHANGE:` footer explaining the migration.

### Pre-commit Checklist

Before every push, run the following from each affected package:

```bash
# Backend
(cd backend  && npm run lint && npm run build && npm test)

# Frontend
(cd frontend && npm run lint && npm run build)
```

---

## Backend (NestJS)

### Code Style

* TypeScript strict mode is configured in `backend/tsconfig.json`.
* `eslint` + `prettier` are the source of truth — `npm run lint` auto-fixes
  style issues.
* Use **type-only imports** (`import type { Foo } from '...'`) where
  possible to keep the emitted JS small.
* Prefer **dependency injection** over importing shared singletons.
* Add **Swagger decorators** (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
  to every controller endpoint.

### Module Architecture

The backend is organised by **feature module**. Every feature lives in its
own folder, exposes a single Nest module, and acquires configuration via
`ConfigService` rather than `process.env`.

```
backend/src/
├── auth/                # Authentication, JWT, TOTP, WebAuthn
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guard/
│   ├── strategies/
│   └── dto/
├── bookings/            # Workspace reservations
├── payments/            # Stellar & invoice orchestration
├── notifications/       # Email, SMS, push channels
└── audit-log/           # Cross-cutting request history
```

Cross-cutting concerns (audit, tracing, CSRF, throttling) are wired globally
in `AppModule` or `main.ts` and never inside feature modules.

### Adding a New Module

1. Create the folder under `backend/src/<feature>/` with:
   * `<feature>.module.ts`
   * `<feature>.controller.ts`
   * `<feature>.service.ts`
   * `entities/`, `dto/`, `interfaces/` as needed
2. Register the module in `backend/src/app.module.ts` **in the order they
   appear in the import array** (feature modules before cross-cutting).
3. Add Swagger decorators + JWT/CSRF guards consistent with peers.
4. Add **unit tests** (`*.spec.ts`) — Stryker mutation score must remain in
   the green.
5. Update `README.md` if the feature is user-visible.

### OpenTelemetry / Tracing

The backend ships with **optional** OpenTelemetry tracing. It is
**disabled by default** and turns on only when an OTLP endpoint is
configured, so there is zero behaviour change in local development.

Activation is driven by these environment variables:

| Variable                       | Purpose                                            | Default                          |
|--------------------------------|----------------------------------------------------|----------------------------------|
| `OTEL_SDK_DISABLED`            | Set `true` to fully disable the SDK (short-circuit)| `false`                          |
| `OTEL_SERVICE_NAME`            | Resource attribute `service.name`                  | `novalabs-backend`               |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | OTLP/HTTP collector endpoint                       | unset → SDK uses provider default|
| `OTEL_EXPORTER_OTLP_HEADERS`   | Auth headers (`k=v,k=v`) for OTLP HTTP             | unset                            |
| `OTEL_LOG_LEVEL`               | Numeric Diag level (0=ALL…30=ERROR)                | unset (silent)                   |
| `NODE_ENV`                     | Reported as `deployment.environment.name` attribute | —                                |

The bootstrap file is `backend/src/telemetry.ts`. It is preloaded via
`node -r ./dist/telemetry dist/main` from the `start:prod` npm script.

**Try it locally** with Jaeger:

```bash
docker run -d --name jaeger \
  -p 16686:16686 -p 4318:4318 \
  jaegertracing/all-in-one:latest

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  npm --prefix backend run start:prod
# Browse traces at http://localhost:16686
```

The instrumentation list lives in `getNodeAutoInstrumentations()` and
includes HTTP, Express, Nest, TypeORM (auto via pg), Redis (via ioredis),
Bull, axios and more. The `fs` instrumentation is intentionally disabled
to keep spans clean.

The SDK initialises inside a `try/catch` and swallows all errors — a
broken telemetry collector must never crash the API.

---

## Frontend (Next.js)

### Frontend Code Style

* TypeScript strict mode, Next 15 App Router conventions.
* ESLint config extends `eslint-config-next`; `npm run lint` must pass.
* Tailwind CSS v4 via `tailwindcss` plugin — utility-first only.
* Forms use [`react-hook-form`](https://react-hook-form.com/) + `zod`
  schemas stored under `lib/schemas/`.

### Component Conventions

* Place reusable UI primitives in `components/ui/` (Radix UI based).
* Feature components live in `components/<feature>/`.
* Pages live in `app/<route>/page.tsx` — server components by default,
  client components only when interactivity is required (`"use client"`).
* All network calls go through `lib/apiClient.ts` (axios) — never call
  `fetch()` directly from a component.

---

## Smart Contracts (Rust / Stellar)

* All contract code lives under `contracts/`.
* Each contract is its own Cargo workspace member; do not introduce nested
  Cargo workspaces unless absolutely necessary.
* Add **unit tests** (`#[test]`) and **property tests** (`proptest`) for any
  financial path.
* Reentrancy guards are enforced by `.semgrep/reentrancy.yml` — keep the
  guard pattern intact when refactoring.
* `cargo fmt --all` and `cargo clippy --all-targets -- -D warnings` must
  pass locally before pushing.

---

## Docker / Deployment

### Hardened Backend Image

The repository ships with a production-grade Dockerfile at the repo root
that produces a minimal, **distroless**, **non-root** container image.

Three stages — `deps`, `build`, and `runtime` — give us:

* Reproducible `npm ci` cache from `package-lock.json`
* Multi-stage that excludes devDependencies from the runtime image
* `gcr.io/distroless/nodejs20-debian12:nonroot` as the runtime base
  (no shell, no package manager, runs as UID 65532)
* `OUT_DIR=dist` only copied to the runtime stage
* Built-in `HEALTHCHECK`-equivalent via documented HTTP `/` probe
* `.dockerignore` excludes `.git`, `node_modules`, `contracts/target`,
  test artefacts, and IDE files

Build & run:

```bash
docker build -t novalabs-backend:latest .

docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_HOST=db.example.com \
  -e DATABASE_USERNAME=novalabs \
  -e DATABASE_PASSWORD=•••••• \
  -e JWT_SECRET=•••••• \
  -e REDIS_HOST=redis.example.com \
  novalabs-backend:latest
```

The full env-var list lives in `backend/.env.example` (or
`backend/README.md` if you maintain one locally). At minimum you must
provide: `DATABASE_*`, `REDIS_*`, `JWT_SECRET`, `NODE_ENV`.

### Environment Variables in Containers

Secrets must come from a runtime secret manager (Docker Swarm secrets,
Kubernetes Secrets, AWS Secrets Manager, Doppler, etc.). **Never bake a
secret into the image.** The distroless runtime is read-only by design and
will not persist state.

Mount a `.dockerignore`-safe folder with `.env` only for local development:

```bash
docker run --rm -p 3000:3000 --env-file .env novalabs-backend:latest
```

---

## Testing

### Backend — Jest & Stryker

```bash
(cd backend && npm test)               # run once
(cd backend && npm run test:watch)     # watch mode
(cd backend && npm run test:cov)       # with coverage
(cd backend && npm run test:mutation)  # Stryker (slow, weekly in CI)
```

* Unit tests live alongside source as `*.spec.ts`.
* E2E tests live under `backend/test/` and run via `npm run test:e2e`.
* Aim for **≥ 80 %** line coverage on any new module, and keep Stryker
  mutation score green for files you touch.

### Frontend — ESLint

The frontend does not currently include a unit runner; rely on ESLint and
TypeScript compile-time safety. Strongly consider adding Vitest for any
non-trivial business logic you introduce.

### Contracts — Cargo

```bash
cd contracts
cargo test --all --verbose           # full suite
cargo clippy --all-targets -- -D warnings
```

---

## Pull Request Process

1. **One concern per PR.** Avoid drive-by refactors.
2. Use the [`PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
   — fill in the description, change-type boxes and test plan.
3. Reference the issue you are closing: `Closes #123`.
4. Ensure CI is green: backend lint + build + tests, frontend lint + build,
   contracts `cargo fmt`/`clippy`/`test`.
5. Make review easy: keep PRs ≤ ~400 lines when possible, link to a
   notebook/design doc for larger changes.
6. After approval, squash-merge is the default. The PR body becomes the
   commit subject — write it accordingly.

`CODEOWNERS` automatically requests reviews from `@NovaCoreLabs1/backend`,
`/frontend`, `/contracts`, and `/infra` teams based on the touched paths.

---

## Issue Labels (Triage Guide)

| Label           | Meaning                                                      |
|-----------------|--------------------------------------------------------------|
| `area:backend`  | Changes in `backend/`                                        |
| `area:frontend` | Changes in `frontend/`                                       |
| `area:contracts`| Changes in `contracts/`                                      |
| `area:infra`    | CI, Docker, build scripts                                    |
| `area:docs`     | Documentation only                                           |
| `area:security` | Security-touching (auth, CSRF, dependency upgrades)          |
| `priority:high` | Releases blocked until merged                               |
| `priority:medium` | Expected in the next sprint                               |
| `good-first-issue` | Scoped for newcomers — mentors assigned on request        |

---

## Maintainers & Contact

NovaLabs is maintained by the **NovaCore Labs** team and an active
contributor community. For day-to-day questions, open a discussion on
GitHub. For sensitive issues, follow [`SECURITY.md`](SECURITY.md).

Happy hacking! 🚀
