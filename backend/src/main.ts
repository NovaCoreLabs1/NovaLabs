import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpLogger } from './common/middlewares/httpLogger.middleware';
import * as crypto from 'crypto';

// Initialize Sentry before anything else
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `backend@${process.env.npm_package_version || '0.0.1'}`,

    // Performance monitoring - configurable via env, defaults to 10%
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

    // CPU profiling for performance insights
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

    integrations: [
      nodeProfilingIntegration(),
    ],

    // Filter out health-check routes from transactions
    beforeSendTransaction(event) {
      const url = event.transaction || '';
      const healthCheckRoutes = ['/api/health', '/health', '/api/ping', '/ping', '/api/ready', '/ready'];
      if (healthCheckRoutes.some((route) => url.includes(route))) {
        return null;
      }
      return event;
    },

    // Add additional context to errors
    beforeSend(event) {
      // Scrub sensitive data if needed
      return event;
    },
  });
}

// Helper to hash user email for privacy
function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email).digest('hex').substring(0, 16);
}

// Export for use in other modules
export { Sentry, hashEmail };

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(new HttpLogger().use);

  // GLOBAL VALIDATION
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // GLOBAL SERIALIZATION
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ENABLE CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [
            'https://novalabs.vercel.app',
            'https://www.novalabs.vercel.app',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3003',
          ]
        : true,
    credentials: true,
  });

  // SWAGGER SETUP
  const config = new DocumentBuilder()
    .setTitle('NovaLabs API')
    .setDescription('API documentation for NovaLabs backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('swagger', app as any, document);

  app.setGlobalPrefix('/api');

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(`Server is listening at: ${await app.getUrl()}`);
}
bootstrap();
