import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpLogger } from './common/middlewares/httpLogger.middleware';
import { CsrfMiddleware } from './common/middlewares/csrf.middleware';
import { ContentTypeMiddleware } from './common/middlewares/content-type.middleware';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AuditLogInterceptor } from './audit-log/interceptors/audit-log.interceptor';
import { resolveCorsConfig } from './common/cors/cors-config';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(cookieParser());
  app.use(new HttpLogger().use);
  app.use(new CsrfMiddleware().use);
  // Enforce application/json content-type on POST/PUT/PATCH requests (Issue #111)
  app.use(new ContentTypeMiddleware().use.bind(new ContentTypeMiddleware()));

  // SAML SSO session middleware. Required by passport-saml to persist the
  // RelayState + InResponseTo across the IdP redirect. Uses an isolated
  // cookie (`saml.sid`) so it does NOT collide with the existing `csrf`
  // cookie. The session secret is the same JWT_SECRET for simplicity —
  // rotate separately if needed.
  app.use(
    session({
      name: 'saml.sid',
      secret: process.env.JWT_SECRET ?? 'novalabs-dev-saml-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 5 * 60 * 1000, // 5 min — long enough for a SAML round-trip
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());
  passport.serializeUser((user: any, done) => done(null, user?.id ?? user));
  passport.deserializeUser(async (id: string, done) => done(null, { id }));

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
  app.useGlobalInterceptors(app.get(AuditLogInterceptor));

  app.useGlobalGuards(new CsrfGuard(app.get(Reflector)));

  // ENABLE CORS
  // Resolve once so a mis-deployed production environment without
  // CORS_ORIGINS fails fast at boot rather than shipping a permissive API.
  const cors = resolveCorsConfig(process.env.NODE_ENV, process.env.CORS_ORIGINS);
  app.enableCors({
    origin: cors.origin,
    credentials: true,
  });
  const originCount = Array.isArray(cors.origin) ? cors.origin.length : 'any';
  console.log(`[CORS] mode=${process.env.NODE_ENV ?? 'development'} allowed=${originCount}`);

  // SWAGGER SETUP
  const config = new DocumentBuilder()
    .setTitle('NovaLabs API')
    .setDescription(
      'API documentation for NovaLabs backend. State-changing endpoints (POST, PUT, PATCH, DELETE) require the x-csrf-token header matching the csrf cookie.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurity('X-CSRF-Token', {
      type: 'apiKey',
      in: 'header',
      name: 'x-csrf-token',
      description:
        'CSRF token required for POST, PUT, PATCH, DELETE requests. Value must match the csrf cookie.',
    })
    .build();
  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('swagger', app as any, document);

  app.setGlobalPrefix('/api');

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
  console.log(`Server is listening at: ${await app.getUrl()}`);
}
bootstrap();
