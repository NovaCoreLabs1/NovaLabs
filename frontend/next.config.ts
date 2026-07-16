import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry configuration for source maps and error tracking
const sentryBuildOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Auth token for uploading source maps (set in CI)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Upload source maps to Sentry during production builds
  widenClientFileUpload: true,
  // Hide source maps from generated client bundles
  hideSourceMaps: true,
  // Disable logger to reduce bundle size
  disableLogger: true,
};

// Only wrap with Sentry config if SENTRY_DSN is provided
export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;
