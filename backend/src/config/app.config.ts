/**
 * Application-level configuration factory for NestJS ConfigModule.
 * Exposes application and Sentry configuration under namespaced keys.
 * Access via ConfigService.get<string>('app.appName') or ConfigService.get<string>('sentry.dsn').
 */
export default () => ({
  appName: process.env.APP_NAME,
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
  },
});
