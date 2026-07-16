import * as Sentry from "@sentry/nextjs";

// Initialize Sentry for the client-side
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV || "development",

  // Performance monitoring - sample 10% of transactions by default
  tracesSampleRate: parseFloat(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || "0.1"
  ),

  // Session Replay - capture 10% of sessions, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

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

  integrations: [
    Sentry.replayIntegration({
      // Mask all text content for privacy
      maskAllText: true,
      // Block all media for privacy
      blockAllMedia: true,
    }),
  ],
});

// Helper to set user context with hashed email
export function setSentryUser(user: { id: string; email?: string }) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  const hashedEmail = user.email
    ? hashString(user.email).substring(0, 16)
    : undefined;

  Sentry.setUser({
    id: user.id,
    email_hash: hashedEmail,
  });
}

// Helper to clear user context on logout
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Simple hash function for client-side use
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
