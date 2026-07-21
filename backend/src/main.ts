import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpLogger } from './common/middlewares/httpLogger.middleware';
import { CsrfMiddleware } from './common/middlewares/csrf.middleware';
import { CsrfGuard } from './common/guards/csrf.guard';
import { AuditLogInterceptor } from './audit-log/interceptors/audit-log.interceptor';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());
  app.use(new HttpLogger().use);
  app.use(new CsrfMiddleware().use);

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
