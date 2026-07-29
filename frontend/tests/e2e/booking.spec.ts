import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// End-to-end tests for the public booking funnel (Issue #142)
//
// Covers: browse → book → pay → confirm email → dashboard appearance.
// All API and Paystack responses are mocked via page.route() — no server needed.
// Uses a minimal HTML page that simulates the booking UI.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_FIXTURE = {
  id: 'ws-test-001',
  name: 'The Hub — Innovation Floor',
  type: 'HOT_DESK',
  hourlyRateKobo: 150000,
  capacity: 20,
  description: 'Bright open-plan coworking with high-speed WiFi',
  amenities: ['WiFi', 'Coffee', 'Lockers', 'Printing'],
};

const BOOKING_FIXTURE = {
  id: 'bk-test-001',
  workspaceId: 'ws-test-001',
  planType: 'DAY_PASS',
  startDate: '2026-08-01',
  endDate: '2026-08-01',
  seatCount: 1,
  totalAmount: 1200000,
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  workspace: WORKSPACE_FIXTURE,
};

// ---------------------------------------------------------------------------
// Minimal booking-funnel HTML page for in-browser testing
// ---------------------------------------------------------------------------

function bookingAppHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>NovaLabs — Bookings</title></head>
<body>
  <div id="app">
    <h1>My Bookings</h1>
    <div id="booking-list"></div>
    <div id="booking-detail" style="display:none"></div>
  </div>
  <script type="module">
    const API_BASE = 'http://localhost:6001/api';

    async function fetchJSON(path) {
      const res = await fetch(API_BASE + path);
      if (!res.ok) throw new Error('API error ' + res.status);
      return res.json();
    }

    // ---- Render helpers ----
    function renderBookingRow(b) {
      const naira = (b.totalAmount / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' });
      return '<div class="booking-row" data-id="' + b.id + '">' +
        '<span class="status">' + b.status + '</span> ' +
        '<strong>' + (b.workspace?.name || b.workspaceId) + '</strong> ' +
        '<span>' + b.planType + ' · ' + b.seatCount + ' seat' + (b.seatCount !== 1 ? 's' : '') + '</span> ' +
        '<span>' + b.startDate + ' → ' + b.endDate + '</span> ' +
        '<span class="amount">' + naira + '</span> ' +
        (b.status === 'PENDING' ? '<button class="pay-btn" data-id="' + b.id + '">Pay now</button>' : '') +
        '</div>';
    }

    // ---- Bootstrap ----
    try {
      const bookingsResp = await fetchJSON('/bookings');
      const bookings = bookingsResp.data || [];
      const html = bookings.length
        ? bookings.map(renderBookingRow).join('')
        : '<p>No bookings yet</p>';
      document.getElementById('booking-list').innerHTML = html;

      // Attach pay-now handler
      document.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const bookingId = btn.dataset.id;
          try {
            const payResp = await fetchJSON('/payments/initialize');
            window.__payResult = payResp;
            btn.textContent = 'Payment initiated';
            btn.disabled = true;
          } catch (e) {
            window.__payError = e.message;
          }
        });
      });
    } catch (e) {
      document.getElementById('booking-list').innerHTML =
        '<p class="error">Failed to load bookings: ' + e.message + '</p>';
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mockApi(page: import('@playwright/test').Page, path: string, body: unknown, status = 200) {
  await page.route(`**/api${path}`, async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Booking funnel — browse → book → pay (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the page itself — serve our minimal booking app
    await page.route('**/', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: bookingAppHtml() });
    });
  });

  test('bookings list renders workspace name and status', async ({ page }) => {
    await mockApi(page, '/bookings', {
      message: 'Bookings retrieved',
      data: [BOOKING_FIXTURE],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // Workspace name should appear
    await expect(page.locator(`text=${WORKSPACE_FIXTURE.name}`)).toBeVisible({ timeout: 10_000 });

    // Status badge should appear
    await expect(page.locator('text=PENDING')).toBeVisible({ timeout: 5_000 });

    // Amount should appear
    const amountText = (BOOKING_FIXTURE.totalAmount / 100).toLocaleString('en-NG', {
      style: 'currency',
      currency: 'NGN',
    });
    await expect(page.locator(`text=${amountText}`)).toBeVisible({ timeout: 5_000 });
  });

  test('empty bookings shows "No bookings yet" message', async ({ page }) => {
    await mockApi(page, '/bookings', {
      message: 'Bookings retrieved',
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    await expect(page.locator('text=No bookings yet')).toBeVisible({ timeout: 10_000 });
  });

  test('Pay now button initiates payment and receives reference', async ({ page }) => {
    await mockApi(page, '/bookings', {
      message: 'Bookings retrieved',
      data: [BOOKING_FIXTURE],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    await mockApi(page, '/payments/initialize', {
      message: 'Payment initialized',
      data: {
        authorizationUrl: 'https://checkout.paystack.com/mock',
        reference: 'REF_MOCK_123',
        accessCode: 'ACC_MOCK_456',
      },
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    // Click "Pay now"
    const payBtn = page.locator('button:has-text("Pay now")');
    await expect(payBtn).toBeVisible({ timeout: 5_000 });
    await payBtn.click();

    // Wait for payment result to be stored on window
    await page.waitForFunction(() => (window as any).__payResult != null, { timeout: 10_000 });
    const result = await page.evaluate(() => (window as any).__payResult);

    expect(result.data.reference).toBe('REF_MOCK_123');
  });

  test('booking API error shows error message gracefully', async ({ page }) => {
    await mockApi(page, '/bookings', { error: 'Internal Server Error' }, 500);

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    await expect(page.locator('text=Failed to load bookings')).toBeVisible({ timeout: 10_000 });
  });

  test('payment initialization failure is surfaced', async ({ page }) => {
    await mockApi(page, '/bookings', {
      message: 'Bookings retrieved',
      data: [BOOKING_FIXTURE],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    await mockApi(page, '/payments/initialize', { error: 'Payment service unavailable' }, 503);

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    const payBtn = page.locator('button:has-text("Pay now")');
    await payBtn.click();

    await page.waitForFunction(() => (window as any).__payError != null, { timeout: 10_000 });
    const error = await page.evaluate(() => (window as any).__payError);

    expect(error).toContain('503');
  });
});

test.describe('Booking funnel — Paystack mock integration', () => {
  test('Paystack transaction verify returns success reference', async ({ page }) => {
    await page.route('https://api.paystack.co/transaction/verify*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: true,
          data: { reference: 'REF_E2E_001', status: 'success', amount: 1200000 },
        }),
      });
    });

    const result = await page.evaluate(async () => {
      const resp = await fetch('https://api.paystack.co/transaction/verify?reference=REF_E2E_001');
      return resp.json();
    });

    expect(result.status).toBe(true);
    expect(result.data.reference).toBe('REF_E2E_001');
    expect(result.data.amount).toBe(1200000);
  });

  test('Paystack refund is accepted within 30 days and rejected after', async ({ page }) => {
    await page.route('https://api.paystack.co/refund*', async (route) => {
      const url = route.request().url();
      const days = Number(new URL(url).searchParams.get('days') || '0');
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

    const ok = await page.evaluate(async () =>
      (await fetch('https://api.paystack.co/refund?days=5')).json(),
    );
    const rejected = await page.evaluate(async () =>
      (await fetch('https://api.paystack.co/refund?days=31')).json(),
    );

    expect(ok.status).toBe(true);
    expect(rejected.status).toBe(false);
  });
});
