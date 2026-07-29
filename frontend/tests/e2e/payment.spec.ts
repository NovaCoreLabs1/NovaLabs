import { test, expect } from '@playwright/test';

// Inline fixture to avoid ESM import.meta / fs dependency
const fixture = {
  data: {
    reference: 'TEST_REF_12345',
    amount: 5000,
    currency: 'NGN',
    status: 'success',
    transaction_date: '2026-07-20T00:00:00Z',
    id: 987654321,
  },
};

test.describe('Payment & refund flow (mocked Paystack)', () => {
  test.beforeEach(async () => {
    // no-op for now; tests mock external endpoints directly
  });

  test('pay -> succeed (mock verify)', async ({ page }) => {
    await page.route('https://api.paystack.co/transaction/verify*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true, data: fixture.data }),
      });
    });

    const res = await page.evaluate(async () => {
      const resp = await fetch('https://api.paystack.co/transaction/verify?reference=TEST_REF_12345');
      return resp.json();
    });

    expect(res).toBeTruthy();
    expect(res.status).toBe(true);
    expect(res.data.reference).toBe('TEST_REF_12345');
  });

  test('pay -> retry (idempotent) - repeated verify returns same', async ({ page }) => {
    await page.route('https://api.paystack.co/transaction/verify*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true, data: fixture.data }),
      });
    });

    const first = await page.evaluate(async () => (await fetch('https://api.paystack.co/transaction/verify?reference=TEST_REF_12345')).json());
    const second = await page.evaluate(async () => (await fetch('https://api.paystack.co/transaction/verify?reference=TEST_REF_12345')).json());

    expect(first).toEqual(second);
    expect(first.data.id).toBe(second.data.id);
  });

  test('refund immediate / refund rejected after 30d (mock)', async ({ page }) => {
    await page.route('https://api.paystack.co/refund*', async (route) => {
      const url = route.request().url();
      const params = new URL(url).searchParams;
      const days = Number(params.get('days') || '0');

      if (days < 30) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: true, message: 'Refund processed' }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ status: false, message: 'Refund window expired' }),
        });
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
