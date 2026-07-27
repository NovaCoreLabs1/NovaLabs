"use client";

/**
 * Issue #39 — Frontend feature-flag helper.
 *
 * The frontend reads the same flag names as the backend service. Today
 * we use `NEXT_PUBLIC_*` env vars to expose them to the client bundle
 * so they can be evaluated synchronously during render. Same shape as
 * the backend `getBoolean` so adding an OpenFeature adapter later only
 * touches this file.
 *
 * We deliberately do NOT call the backend `/api/feature-flags` endpoint
 * on every render — that would (a) re-introduce the network dependency
 * the issue is trying to avoid, and (b) make the UI flicker between
 * branches while waiting for the response.
 */
export interface FrontendFlags {
  bookingWizardV2: boolean;
  multisigV2: boolean;
  adminImpersonation: boolean;
  sentryTracing: boolean;
}

const ENV_FLAG_MAP: Record<keyof FrontendFlags, string> = {
  bookingWizardV2: 'NEXT_PUBLIC_FF_BOOKING_WIZARD_V2',
  multisigV2: 'NEXT_PUBLIC_FF_MULTISIG_V2',
  adminImpersonation: 'NEXT_PUBLIC_FF_ADMIN_IMPERSONATION',
  sentryTracing: 'NEXT_PUBLIC_FF_SENTRY_TRACING',
};

const DEFAULTS: FrontendFlags = {
  bookingWizardV2: false,
  multisigV2: false,
  adminImpersonation: false,
  sentryTracing: true,
};

function readEnvBool(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const lowered = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(lowered)) return true;
  if (['false', '0', 'no', 'off'].includes(lowered)) return false;
  return undefined;
}

/**
 * Resolve the current snapshot of client-side feature flags.
 * Pure function — safe to call during render.
 */
export function readFrontendFlags(): FrontendFlags {
  const result = { ...DEFAULTS };
  for (const key of Object.keys(ENV_FLAG_MAP) as (keyof FrontendFlags)[]) {
    const env = ENV_FLAG_MAP[key];
    const parsed = readEnvBool(process.env[env]);
    if (parsed !== undefined) {
      result[key] = parsed;
    }
  }
  return result;
}
