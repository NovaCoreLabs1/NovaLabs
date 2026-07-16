import * as Sentry from "@sentry/nextjs";

// Initialize Sentry for the server-side (Node.js runtime)
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV || "development",

  // Performance monitoring - sample 10% of transactions by default
  tracesSampleRate: parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.1"
  ),

  // Set to false in development for cleaner console output
  debug: false,

  // Filter out health-check routes from transactions
  beforeSendTransaction(event) {
    const url = event.transaction || "";
    const healthCheckRoutes = ["/health", "/ping", "/ready", "/api/health"];
    if (healthCheckRoutes.some((route) => url.includes(route))) {
      return null;
    }
    return event;
  },
});
