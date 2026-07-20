E2E tests (payment + refund loop)
================================

This folder contains a scaffold for end-to-end tests covering pay->refund flows (issue #143).

Setup (local)
--------------

1. Install Playwright in `frontend`:

```bash
cd frontend
npm install -D @playwright/test
npx playwright install --with-deps
```

2. Run the scaffold test (it contains skipped tests as placeholders):

```bash
npx playwright test tests/e2e/payment.spec.ts
```

Fixtures
--------
Deterministic webhook fixtures live under `frontend/tests/fixtures/` and should be used to mock Paystack webhook payloads during CI.

CI notes
--------
- Use `playwright` runner in CI, start backend server in test mode, seed deterministic fixtures.
- Mock external Paystack API endpoints (checkout/verify/webhook) using Playwright `page.route` or a local stub server.
