# `common/`

Shared utilities, guards, interceptors, and middleware used across modules.

## Purpose

Provides cross-cutting concerns: CSRF protection, content-type enforcement,
IP utilities, HTML sanitization, and HTTP logging middleware.

## Key Components

### Guards

- **CsrfGuard** (`guards/csrf.guard.ts`) — validates CSRF tokens on
  mutating requests via double-submit cookie pattern.

### Middleware

- **csrf.middleware.ts** — sets CSRF cookie on GET requests.
- **content-type.middleware.ts** — enforces `Content-Type: application/json`
  on POST/PATCH/PUT endpoints.
- **httpLogger.middleware.ts** — structured HTTP request/response logging.

### Utilities

- **ip.util.ts** — extracts client IP from `x-forwarded-for` and other headers.
- **sanitize-string.transformer.ts** — class-transformer that strips HTML and
  script tags from user inputs.

## Key Files

| File                                       | Role                           |
| ------------------------------------------ | ------------------------------ |
| `guards/csrf.guard.ts`                     | CSRF validation guard          |
| `middlewares/csrf.middleware.ts`           | CSRF cookie middleware         |
| `middlewares/content-type.middleware.ts`   | Content-Type enforcement       |
| `middlewares/httpLogger.middleware.ts`     | HTTP request logging           |
| `transformers/sanitize-string.transformer.ts`| Input sanitization transformer|
| `utils/ip.util.ts`                         | Client IP extraction           |
| `utils/ip.util.spec.ts`                    | IP utility tests               |
