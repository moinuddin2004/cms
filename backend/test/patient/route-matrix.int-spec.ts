/*
 * Route matrix — M0-09 skeleton (docs 03 §7, 09 §3).
 *
 * Boots the real module graph (AppModule, so the real global guard chain with
 * PatientFenceGuard first) against a throw-away schema, enumerates every
 * controller route by reflection and sends a fake patient token (signed with
 * the patient secret, `aud: 'patient'`) to every non-patient, non-public
 * route. The staff JWT guard must reject it (401); a `/patient-api` route
 * without `@PatientApi()` is refused by the fence (403).
 *
 * Public routes (`@Public()`, e.g. `/auth/login`, `/app/min-version`) are
 * skipped: they are unauthenticated by design.
 *
 * The second half — every `/patient-api` route rejects a staff token — lands
 * with the first real patient routes in M2-03.
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { randomUUID } from 'crypto';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { UUID_V7_FUNCTION_SQL } from 'src/common/database/uuid-v7';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { GlobalExceptionFilter } from 'src/common/exceptions/HttpExceptionHandler';
import { AppLogger } from 'src/common/services/logger.service';
import { itDatabaseUrl, itSsl } from '../billing/db.config';

/** Own schema, created and dropped by this spec (never `public`). */
const PATIENT_IT_SCHEMA = 'patientit';
/** Distinct from `JWT_ACCESS_SECRET`: a patient token must not verify as staff. */
const PATIENT_TEST_SECRET = 'route-matrix-patient-secret';

// Booting the whole module graph is slower than a unit test.
jest.setTimeout(180_000);

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Route {
  id: string;
  method: HttpMethod;
  url: string;
  isPublic: boolean;
  isPatient: boolean;
}

const METHOD_BY_NEST: Partial<Record<RequestMethod, HttpMethod>> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
};

async function runSql(sql: string): Promise<void> {
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

/** `@Controller` + method path → a callable URL; every `:param` is a UUID. */
function buildRoutePath(base: string, path: string): string {
  const joined = `/${base}/${path}`.replace(/\/+/g, '/');
  const trimmed = joined.length > 1 ? joined.replace(/\/$/, '') : joined;
  return trimmed
    .split('/')
    .map((segment) => (segment.startsWith(':') ? randomUUID() : segment))
    .join('/');
}

function collectRoutes(): Route[] {
  const routes: Route[] = [];
  for (const file of controllerFiles(join(__dirname, '../../src'))) {
    const mod = require(file) as Record<string, unknown>;
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      const ctrlPath = Reflect.getMetadata(PATH_METADATA, exported) as
        | string
        | string[]
        | undefined;
      if (ctrlPath === undefined) continue;

      const base = [ctrlPath].flat()[0] ?? '';
      const isPublicCtrl =
        Reflect.getMetadata(IS_PUBLIC_KEY, exported) !== undefined;
      const proto = (exported as { prototype: object }).prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        const fn = (proto as Record<string, unknown>)[name];
        if (typeof fn !== 'function') continue;

        const method =
          METHOD_BY_NEST[
            Reflect.getMetadata(METHOD_METADATA, fn) as RequestMethod
          ];
        if (!method) continue;

        const path = (Reflect.getMetadata(PATH_METADATA, fn) as string) ?? '';
        const url = buildRoutePath(base, path);
        routes.push({
          id: `${exported.name}.${name}`,
          method,
          url,
          isPublic:
            isPublicCtrl ||
            Reflect.getMetadata(IS_PUBLIC_KEY, fn) !== undefined,
          isPatient:
            url === '/patient-api' ||
            url.startsWith('/patient-api/') ||
            url === '/patient-auth' ||
            url.startsWith('/patient-auth/'),
        });
      }
    }
  }
  return routes;
}

describe('Patient fence — route matrix (API)', () => {
  let app: INestApplication | undefined;
  let routes: Route[];

  const server = (): App => {
    if (!app) throw new Error('app not booted');
    return app.getHttpServer() as App;
  };

  const patientToken = (): string => {
    const { sign } = require('jsonwebtoken') as typeof import('jsonwebtoken');
    return sign(
      {
        sub: randomUUID(),
        email: 'route-matrix@patient.test',
        aud: 'patient',
      },
      PATIENT_TEST_SECRET,
      { expiresIn: '15m' },
    );
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= 'route-matrix-staff-secret';
    process.env.JWT_PATIENT_ACCESS_SECRET ??= PATIENT_TEST_SECRET;

    await runSql('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await runSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await runSql(UUID_V7_FUNCTION_SQL);
    await runSql(`DROP SCHEMA IF EXISTS ${PATIENT_IT_SCHEMA} CASCADE`);
    await runSql(`CREATE SCHEMA ${PATIENT_IT_SCHEMA}`);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: itDatabaseUrl(),
          ssl: itSsl(),
          entities: [join(__dirname, '../../src/**/*.entity.ts')],
          synchronize: true,
          extra: {
            options: `-c search_path=${PATIENT_IT_SCHEMA},public`,
            max: 10,
          },
        }),
        // The real module graph — the real global guard chain, including the
        // PatientFenceGuard registered first in app.module.ts.
        AppModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: ['error'] });
    // Same options as src/bootstrap/http.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(
      new GlobalExceptionFilter({
        info: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        error: () => undefined,
      } as unknown as AppLogger),
    );
    await app.init();
    routes = collectRoutes();
  });

  afterAll(async () => {
    await app?.close();
    await runSql(`DROP SCHEMA IF EXISTS ${PATIENT_IT_SCHEMA} CASCADE`);
  });

  it('lists the whole route table', () => {
    expect(routes.length).toBeGreaterThan(300);
  });

  it('rejects a patient token on every non-patient, non-public route', async () => {
    const token = patientToken();
    const call = request(server()) as unknown as Record<
      HttpMethod,
      (url: string) => request.Test
    >;
    const failures: string[] = [];

    for (const route of routes.filter((r) => !r.isPublic && !r.isPatient)) {
      const res = await call[route.method](route.url)
        .set('Authorization', `Bearer ${token}`)
        .set('x-organization-id', randomUUID())
        .set('x-location-id', randomUUID());
      if (res.status !== 401 && res.status !== 403)
        failures.push(
          `${route.id} ${route.method.toUpperCase()} ${route.url} → ${res.status}`,
        );
    }

    expect(failures).toEqual([]);
  });

  it('has the first patient routes — the staff-token half lands in M2-03', () => {
    expect(routes.filter((r) => r.isPatient).length).toBeGreaterThan(0);
  });
});
