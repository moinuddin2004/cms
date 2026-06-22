import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { RequestContextService } from './common/services/request-context.service';
import { GlobalExceptionFilter } from './common/exceptions/HttpExceptionHandler';
import { AppLogger } from './common/services/logger.service';
import * as cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // Disable Nest's default body parser so we can raise the size limit —
  // consent signatures are stored inline as base64 PNG data URLs.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(app.get(AppLogger)));
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  app.use(cookieParser());
  const contextService = app.get(RequestContextService);
  app.use((req, res, next) => contextService.run(req.user, () => next()));
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
