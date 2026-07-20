// Playwright E2E scaffold for payment + refund loop (issue #143)
// Requires Playwright: `npm i -D @playwright/test`
// Run with: `npx playwright test frontend/tests/e2e/payment.spec.ts`

import { test, expect } from '@playwright/test';

test.describe('Payment & refund flow (mocked Paystack)', () => {
  test.beforeEach(async ({ page }) => {
    // no-op for now; tests mock external endpoints directly
  });

  test('pay -> succeed (mock verify)', async ({ page }) => {
    const fs = require('fs');
    const fixture = JSON.parse(fs.readFileSync(process.cwd() + '/frontend/tests/fixtures/paystack-webhook-success.json', 'utf8'));

    // Mock Paystack verify endpoint
    await page.route('https://api.paystack.co/transaction/verify*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true, data: fixture.data }),
      });
    });

    // From the page context, call the Paystack verify URL and assert response
    const res = await page.evaluate(async () => {
      const resp = await fetch('https://api.paystack.co/transaction/verify?reference=TEST_REF_12345');
      return resp.json();
    });

    expect(res).toBeTruthy();
    expect(res.status).toBe(true);
    expect(res.data.reference).toBe('TEST_REF_12345');
  });

  test('pay -> retry (idempotent) - repeated verify returns same', async ({ page }) => {
    const fs = require('fs');
    const fixture = JSON.parse(fs.readFileSync(process.cwd() + '/frontend/tests/fixtures/paystack-webhook-success.json', 'utf8'));

    await page.route('https://api.paystack.co/transaction/verify*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: true, data: fixture.data }) });
    });

    const first = await page.evaluate(async () => (await fetch('https://api.paystack.co/transaction/verify?reference=TEST_REF_12345')).json());
    const second = await page.evaluate(async () => (await fetch('https://api.paystack.co/transaction/verify?reference=TEST_REF_12345')).json());

    expect(first).toEqual(second);
    expect(first.data.id).toBe(second.data.id);
  });

  test('refund immediate / refund rejected after 30d (mock)', async ({ page }) => {
    // Mock refund endpoint to accept immediate refunds and reject older refunds
    await page.route('https://api.paystack.co/refund*', async (route) => {
      const url = route.request().url();
      const params = new URL(url).searchParams;
      const days = Number(params.get('days') || '0');
      if (days < 30) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: true, message: 'Refund processed' }) });
      } else {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ status: false, message: 'Refund window expired' }) });
      }
    });

    const ok = await page.evaluate(async () => (await fetch('https://api.paystack.co/refund?days=0')).json());
    const rejected = await page.evaluate(async () => {
      const r = await fetch('https://api.paystack.co/refund?days=31');
      return r.json();
    });

    expect(ok.status).toBe(true);
    expect(rejected.status).toBe(false);
  });
});
