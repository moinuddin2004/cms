import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from '../app.module';
import { RequestContextService } from '../common/services/request-context.service';
import { GlobalExceptionFilter } from '../common/exceptions/HttpExceptionHandler';
import { AppLogger } from '../common/services/logger.service';
import { ProcessRole } from '../common/runtime/process-role';

/** HTTP + Socket.IO process (`all` or `api` role). */
export async function bootstrapHttp(role: Extract<ProcessRole, 'all' | 'api'>) {
  // Disable Nest's default body parser so we can raise the size limit —
  // consent signatures are stored inline as base64 PNG data URLs.
  const app = await NestFactory.create(AppModule.forRole(role), { bodyParser: false });
  app.enableShutdownHooks();
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
  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  new Logger('Bootstrap').log(`${role} process (pid ${process.pid}) listening on :${port}`);
}
