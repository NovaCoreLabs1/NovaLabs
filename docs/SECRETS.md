# Secret Rotation Runbook

This document lists every secret used by NovaLabs, how to rotate it, and
cooling-off notes to avoid service disruption during rotation.

> **Rule of thumb**: rotate secrets during a maintenance window. Keep the old
> secret valid for at least 15 minutes after the new one is deployed so
> in-flight requests can drain.

---

## 1. Paystack

| Variable | Description |
|----------|-------------|
| `PAYSTACK_SECRET_KEY` | Live/test secret key used for payment API calls and webhook signature verification |

### How to rotate

1. Log in to [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings** → **API Keys & Webhooks**.
2. Click **Regenerate Keys** (this immediately invalidates the old key).
3. Copy the new **Secret Key**.
4. Update `PAYSTACK_SECRET_KEY` in your environment (e.g. Vercel/Railway env vars).
5. Deploy the updated backend.

### Cooling-off

- Paystack invalidates the old key immediately upon regeneration.
- Any in-flight webhook verifications will fail for ~30 seconds until the deploy propagates.
- **Mitigation**: If high-volume, keep the old key in a second env var (`PAYSTACK_SECRET_KEY_PREV`) temporarily and fall back to it for webhook verification during the transition.

---

## 2. SMTP (Email)

| Variable | Description |
|----------|-------------|
| `SMTP_PASSWORD` | Password or app-specific password for the SMTP relay |

### How to rotate

1. Log in to your email provider (Gmail, Mailgun, etc.).
   - **Gmail**: Google Account → Security → 2-Step Verification → App passwords → Generate new.
   - **Mailgun**: Dashboard → Sending → API keys → Reset SMTP password.
2. Update `SMTP_PASSWORD` in your environment.
3. Deploy the updated backend.
4. Send a test email from `/api/auth/register` or trigger the forgot-password flow to verify.

### Cooling-off

- Most SMTP providers allow the old password for a grace period (Gmail: none, Mailgun: up to 1 hour).
- **Mitigation**: Test the new credentials in a staging environment before deploying to production.

---

## 3. Cloudinary (Image Upload)

| Variable | Description |
|----------|-------------|
| `CLOUDINARY_API_SECRET` | Secret for signing API requests |
| `CLOUDINARY_API_KEY` | API key (rotate together with the secret) |
| `CLOUDINARY_URL` | Optional shorthand (`cloudinary://key:secret@cloud_name`) |

### How to rotate

1. Log in to [Cloudinary Console](https://console.cloudinary.com/) → **Settings** → **Upload** → **Security**.
2. Click **Rotate** next to the API Secret (or **Reset** for the full key pair).
3. Copy the new **API Key** and **API Secret**.
4. Update `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in your environment.
5. Deploy the updated backend.
6. Verify by uploading a profile picture.

### Cooling-off

- Cloudinary allows both old and new keys for a 1-hour window after rotation.
- In-flight image uploads may fail if the old key is revoked before the deploy completes.

---

## 4. Soroban / Stellar (Smart Contract Escrow)

| Variable | Description |
|----------|-------------|
| `STELLAR_SECRET_KEY` | Stellar secret (private) key for signing Soroban transactions |
| `STELLAR_ESCROW_CONTRACT_ID` | On-chain contract address (changes only if redeployed) |

### How to rotate

1. Generate a new Stellar keypair: `stellar keys generate --network testnet`
2. Fund the new account on the relevant network.
3. Update `STELLAR_SECRET_KEY` in your environment.
4. If the contract requires a specific signer, deploy a new contract instance with the new key as the admin and update `STELLAR_ESCROW_CONTRACT_ID`.
5. Deploy the updated backend.
6. Test the full payment-escrow flow on testnet first.

### Cooling-off

- Old signing key is valid until you revoke it from the contract (if using a multisig or admin pattern).
- In-flight escrow operations will fail if the old key is revoked mid-flight.
- **Mitigation**: Monitor pending transactions during the rotation window. For production escrow, coordinate with the beneficiary address (`STELLAR_BENEFICIARY_ADDRESS`).

---

## 5. JWT Secrets

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Signs and verifies access tokens |
| `JWT_REFRESH_SECRET` | Signs and verifies refresh tokens (separate from access tokens) |

### How to rotate

1. Generate two new secrets:
   ```bash
   JWT_SECRET=$(openssl rand -base64 48)
   JWT_REFRESH_SECRET=$(openssl rand -base64 48)
   ```
2. Update both `JWT_SECRET` and `JWT_REFRESH_SECRET` in your environment.
3. Deploy the updated backend.

### Cooling-off

- **Critical**: All existing access and refresh tokens become invalid immediately.
- Users will be logged out and must re-authenticate.
- **Mitigation options**:
  - **Zero-downtime rotation**: Keep the old secret as `JWT_SECRET_PREV` and check both secrets during token verification for a grace period (e.g. 24 hours). After the grace period, remove the old secret.
  - **Scheduled rotation**: Announce a maintenance window. All users will need to log in again.

---

## 6. PostgreSQL Database

| Variable | Description |
|----------|-------------|
| `DATABASE_PASSWORD` | Database connection password |

### How to rotate

1. Connect to the database and create a new user/password:
   ```sql
   ALTER USER novalabs_user WITH PASSWORD 'new_password';
   ```
2. Update `DATABASE_PASSWORD` in your environment.
3. Deploy the updated backend.
4. Verify the application starts and can query data.

### Cooling-off

- PostgreSQL allows both old and new passwords until the old connection pool drains.
- **Mitigation**: If using PgBouncer or connection pooling, restart the pooler after deploying.

---

## 7. Redis

| Variable | Description |
|----------|-------------|
| `REDIS_PASSWORD` | Password for Redis authentication |

### How to rotate

1. Connect to Redis and set a new password:
   ```
   CONFIG SET requirepass "new_password"
   ```
2. Update `REDIS_PASSWORD` in your environment.
3. Deploy the updated backend (or restart the application to reset the connection pool).

### Cooling-off

- Old connections remain valid until they are closed by the client.
- **Mitigation**: Restart the application after deploying the new password to flush stale connections.

---

## General Checklist

When rotating any secret:

- [ ] Generate a new, strong secret (use `openssl rand -base64 48` for JWT-like secrets).
- [ ] Update the environment variable in your deployment platform.
- [ ] Deploy the updated application.
- [ ] Verify the application starts and core flows work (login, register, payments).
- [ ] Monitor error logs for 15–30 minutes after rotation.
- [ ] Remove the old secret from any backup locations after the grace period.
- [ ] Update this runbook if the rotation process changes.
