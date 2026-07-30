import { z } from 'zod';

/**
 * Frontend environment schema validated at boot time.
 *
 * Any variable listed here as required (non-optional) will **crash** the
 * Next.js process if it is missing at build or runtime, providing an
 * immediate, clear failure rather than a silent misconfiguration.
 */
const envSchema = z.object({
  /** Base URL for the NovaLabs backend API.
   *  Must be a valid URL. Falls back to localhost in development;
   *  production deployments MUST set this explicitly. */
  NEXT_PUBLIC_API_URL: z
    .string()
    .url('NEXT_PUBLIC_API_URL must be a valid URL')
    .default('http://localhost:6001/api'),

  /** Human-readable application name shown in browser tabs, emails, etc. */
  NEXT_PUBLIC_APP_NAME: z.string().default('NovaLabs'),

  /** Current runtime environment. */
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

/**
 * Parsed and validated environment object.  Use this instead of reading
 * `process.env` directly anywhere in the frontend application.
 *
 * Example:
 * ```ts
 * import { env } from '@/utils/env';
 * console.log(env.NEXT_PUBLIC_API_URL); // typed as `string`
 * ```
 */
export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NODE_ENV: process.env.NODE_ENV,
}) as Readonly<z.infer<typeof envSchema>>;
