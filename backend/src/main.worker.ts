import './bootstrap/utc';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Worker: outbox relay (→ Redis → every API instance) + scheduled jobs.
// No HTTP server. Run exactly one.
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule.forRole('worker'));
  app.enableShutdownHooks();
  new Logger('Bootstrap').log(`worker process (pid ${process.pid}) started`);
}
bootstrap();
