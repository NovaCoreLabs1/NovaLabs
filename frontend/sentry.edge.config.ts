import * as Sentry from "@sentry/nextjs";

// Initialize Sentry for the edge runtime (middleware, edge API routes)
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV || "development",

  // Performance monitoring - sample 10% of transactions by default
  tracesSampleRate: parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.1"
  ),

  // Set to false in development for cleaner console output
  debug: false,
});
