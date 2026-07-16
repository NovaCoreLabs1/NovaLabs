# Secrets Management

This document describes how NovaLabs handles sensitive credentials and how to rotate them safely.

## Paystack secret keys

Paystack uses a single secret key for API calls and for signing webhook payloads. The backend reads:

| Variable | Required | Purpose |
|----------|----------|---------|
| `PAYSTACK_SECRET_KEY` | Yes | Current secret for Paystack API calls and webhook verification |
| `PAYSTACK_SECRET_KEY_PREVIOUS` | No | Previous secret accepted for webhook verification during rotation |

API requests (`initialize`, `verify`, `refund`) always use `PAYSTACK_SECRET_KEY` only. Webhook verification accepts either the current or previous secret when the previous value is configured.

Reference: [Paystack webhooks](https://docs.paystack.com/webhooks)

### Rotating `PAYSTACK_SECRET_KEY`

Use this process to avoid rejecting valid webhooks while Paystack finishes delivering events signed with the old key.

1. Generate or rotate the secret in the Paystack dashboard.
2. Deploy with:
   - `PAYSTACK_SECRET_KEY=<new secret>`
   - `PAYSTACK_SECRET_KEY_PREVIOUS=<old secret>`
3. Confirm incoming webhooks succeed for both keys (see `paystack.provider.spec.ts`).
4. Keep `PAYSTACK_SECRET_KEY_PREVIOUS` configured for up to **7 days** to cover delayed or retried webhook deliveries.
5. After 7 days, remove `PAYSTACK_SECRET_KEY_PREVIOUS` from the environment and redeploy.

Do not delete the old secret from configuration immediately after rotation. Removing it too early can cause legitimate webhook deliveries to fail with `401 Invalid Paystack webhook signature`.

### Local development

Add both variables to `backend/.env` when testing rotation:

```env
PAYSTACK_SECRET_KEY=sk_test_current
PAYSTACK_SECRET_KEY_PREVIOUS=sk_test_previous
```

Leave `PAYSTACK_SECRET_KEY_PREVIOUS` unset during normal development if you are not rotating keys.
