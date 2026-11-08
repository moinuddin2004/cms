import { DynamicModule, INestApplicationContext, Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AppModule } from 'src/app.module';
import { pgSsl } from 'src/common/database/pg-ssl';
import { DbClock } from './db-clock';

/**
 * The app's full module graph, minus everything that runs on its own:
 * no HTTP server, no Socket.IO gateway, no scheduled jobs, no outbox /
 * notification relays. The seed calls services directly; nothing is sent.
 */
function seedModule(databaseUrl: string, searchPath: string): DynamicModule {
  return {
    module: AppModule,
    imports: [
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: databaseUrl,
        ssl: pgSsl(),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
        // The DB clock schema first (time travel), then the data schema.
        extra: {
          options: `-c search_path=${searchPath}`,
          max: Number(process.env.SEED_POOL_MAX || 10),
          // The main process sits idle while the visit children run (10+ min);
          // hosted Postgres drops idle connections, so don't keep them around.
          idleTimeoutMillis: 10_000,
          keepAlive: true,
        },
      }),
    ],
  };
}

export interface SeedApp {
  app: INestApplicationContext;
  ds: DataSource;
  get<T>(type: Type<T>): T;
  close(): Promise<void>;
}

/**
 * Neon's pooler (pgbouncer) rejects the `options` startup parameter the
 * search_path needs, so the seed talks to the direct endpoint.
 */
function directUrl(raw: string): string {
  const url = new URL(raw);
  url.hostname = url.hostname.replace('-pooler', '');
  url.searchParams.delete('channel_binding');
  return url.toString();
}

export async function bootSeedApp(): Promise<SeedApp> {
  config({ path: join(__dirname, '../../../.env') });

  // Nothing may leave this process: no SMTP (emails are only logged), no Redis.
  for (const k of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'REDIS_URL']) {
    process.env[k] = '';
  }

  const raw = process.env.SEED_DATABASE_URL || process.env.DATABASE_URL;
  if (!raw) throw new Error('Set DATABASE_URL (or SEED_DATABASE_URL) in backend/.env');
  const url = directUrl(raw);

  const clock = new DbClock({ connectionString: url, ssl: pgSsl() || undefined });
  await clock.create(process.env.SEED_SCHEMA || 'public');

  try {
    const app = await NestFactory.createApplicationContext(
      // SEED_SCHEMA: only for `npm run seed:check` (a throw-away schema).
      seedModule(url, clock.searchPath(process.env.SEED_SCHEMA || undefined)),
      { logger: ['error', 'warn'] },
    );
    await app.init();
    const ds = app.get(DataSource);
    return {
      app,
      ds,
      get: (type) => app.get(type, { strict: false }),
      close: async () => {
        // Let fire-and-forget work (notify() after commit) finish first.
        await new Promise((r) => setTimeout(r, 3000));
        await app.close();
        await clock.drop();
      },
    };
  } catch (err) {
    await clock.drop();
    throw err;
  }
}
