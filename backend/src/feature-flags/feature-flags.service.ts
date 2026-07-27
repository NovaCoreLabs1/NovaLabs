import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Issue #39 — Feature flag service.
 *
 * OpenFeature-shaped API surface (`getBoolean`) on top of an
 * environment-variable store. Resolves the flag at call-site so that
 * flipping the env var + restarting a single pod is sufficient to
 * toggle behaviour — no separate PostHog / Unleash Dashboard required
 * for the first slice.
 *
 * Why env-var only at this stage:
 *   - Zero new runtime dependency in CI / dev / offline sandboxes.
 *   - The OpenFeature Provider interface is implemented in spirit only
 *     so we can drop in a PostHog / Unleash adapter later without
 *     changing call sites (`getBoolean('booking-wizard-v2')`).
 *   - Local override via `.env` works out of the box via ConfigService.
 *
 * Variant support is scoped to `{ control: false, treatment: true }` —
 * A/B-rollout percents are deferred to the OpenFeature adapter PR.
 */
@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly defaultBooleanFlags = new Map<string, boolean>([
    ['booking-wizard-v2', false],
    ['multisig-v2', false],
    ['admin-impersonation', false],
    ['sentry-tracing', true],
  ]);

  /**
   * Map of flag → boolean. Populated from env on boot, can be hot-reloaded
   * via `refreshFromEnv()` (used by the optional `/admin/feature-flags/refresh`
   * endpoint defined in the controller).
   */
  private booleanFlags = new Map<string, boolean>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.refreshFromEnv();
  }

  /**
   * Synchronously read a boolean flag. Returns the boolean-default if the
   * flag has never been registered; throws nothing — reads must always be
   * safe on a hot path.
   */
  getBoolean(flag: string): boolean {
    const override = this.booleanFlags.get(flag);
    if (override !== undefined) {
      return override;
    }
    const fallback = this.defaultBooleanFlags.get(flag);
    if (fallback !== undefined) {
      return fallback;
    }
    // Strict default: false. This matches OpenFeature's "false on unknown".
    this.logger.warn(`feature-flag '${flag}' is unset; defaulting to false`);
    return false;
  }

  /** Read the variant for a flag. Today: only { control | treatment }. */
  getVariant(flag: string): 'control' | 'treatment' {
    return this.getBoolean(flag) ? 'treatment' : 'control';
  }

  /** Returns the names of all registered flags (defaults + overrides). */
  listFlags(): { name: string; enabled: boolean; source: 'env' | 'default' }[] {
    const result: {
      name: string;
      enabled: boolean;
      source: 'env' | 'default';
    }[] = [];
    for (const [name, enabled] of this.defaultBooleanFlags.entries()) {
      result.push({
        name,
        enabled: this.booleanFlags.get(name) ?? enabled,
        source: this.booleanFlags.has(name) ? 'env' : 'default',
      });
    }
    return result;
  }

  /**
   * Pull a snapshot of env-driven flag overrides into memory.
   * Convention: env var FF_<UPPER_SNAKE> = 'true' | 'false'.
   */
  refreshFromEnv(): void {
    this.booleanFlags.clear();
    for (const [name] of this.defaultBooleanFlags.entries()) {
      const envName = `FF_${this.toUpperSnake(name)}`;
      const raw = this.configService.get<string>(envName);
      if (raw === undefined) {
        continue;
      }
      const lowered = raw.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lowered)) {
        this.booleanFlags.set(name, true);
      } else if (['false', '0', 'no', 'off'].includes(lowered)) {
        this.booleanFlags.set(name, false);
      } else {
        this.logger.warn(
          `feature-flag ${name} env var ${envName}=${raw} is unparseable; ignored`,
        );
      }
    }
  }

  private toUpperSnake(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  }
}
