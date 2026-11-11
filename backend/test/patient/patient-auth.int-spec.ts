/*
 * Patient auth — M2-02 integration spec. Runs ONLY on a disposable Postgres
 * (own schema, created and dropped here; same harness as route-matrix).
 *
 * start → code read from the mocked mailer → verify → GET /patient-api/me →
 * refresh → old refresh token rejected → that reuse revoked the session.
 *
 * `synchronize` does not create the patient partial/expression indexes, so
 * `database/changes/2026-11-12_patient_identity.sql` is run after it (08 §7).
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { readFileSync } from 'fs';
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { resetRateLimits } from 'src/auth/guards/rate-limiter.guard';
import { UUID_V7_FUNCTION_SQL } from 'src/common/database/uuid-v7';
import { GlobalExceptionFilter } from 'src/common/exceptions/HttpExceptionHandler';
import { AppLogger } from 'src/common/services/logger.service';
import { MailService } from 'src/common/services/mail.service';
import { itDatabaseUrl, itSsl } from '../billing/db.config';

const SCHEMA = 'patientauthit';
jest.setTimeout(180_000);

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

describe('patient auth (int)', () => {
  let app: INestApplication;
  const sent: { email: string; code: string }[] = [];
  const server = () => app.getHttpServer() as App;
  const EMAIL = 'Patient.One@Example.com';
  const versions = { termsVersion: '1.0', privacyVersion: '1.0' };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= 'patient-auth-it-staff-secret';
    process.env.JWT_PATIENT_ACCESS_SECRET = 'patient-auth-it-patient-secret';

    await runSql('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await runSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await runSql(UUID_V7_FUNCTION_SQL);
    await runSql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await runSql(`CREATE SCHEMA ${SCHEMA}`);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: itDatabaseUrl(),
          ssl: itSsl(),
          entities: [join(__dirname, '../../src/**/*.entity.ts')],
          synchronize: true,
          extra: { options: `-c search_path=${SCHEMA},public`, max: 10 },
        }),
        AppModule,
      ],
    })
      .overrideProvider(MailService)
      .useValue({
        sendLoginCode: (email: string, code: string) => {
          sent.push({ email, code });
          return Promise.resolve(true);
        },
      })
      .compile();

    // Partial / expression indexes the entities cannot declare (08 §7).
    const changes = readFileSync(
      join(__dirname, '../../database/changes/2026-11-12_patient_identity.sql'),
      'utf8',
    );
    const client = new Client({
      connectionString: itDatabaseUrl(),
      ssl: itSsl(),
    });
    await client.connect();
    try {
      await client.query(`SET search_path TO ${SCHEMA},public`);
      await client.query(changes);
    } finally {
      await client.end();
    }

    app = moduleRef.createNestApplication({ logger: ['error'] });
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
  });

  beforeEach(() => resetRateLimits());

  afterAll(async () => {
    await app?.close();
    await runSql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  });

  const start = () =>
    request(server()).post('/patient-auth/email/start').send({ email: EMAIL });
  const verify = (code: string) =>
    request(server())
      .post('/patient-auth/email/verify')
      .send({ email: EMAIL, code, ...versions });

  it('start → verify → me → refresh → old token rejected → reuse revokes', async () => {
    const res = await start().expect(200);
    expect(res.body.data).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].email).toBe('patient.one@example.com');

    const ok = await verify(sent[0].code).expect(200);
    const s1 = ok.body.data;
    expect(s1.isNewAccount).toBe(true);
    expect(s1.needsName).toBe(true);
    expect(s1.account.email).toBe('patient.one@example.com');

    // Code is single use.
    const again = await verify(sent[0].code);
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe('CODE_INVALID');

    // Patient token reaches /patient-api/me; a staff-style call without a token does not.
    await request(server()).get('/patient-api/me').expect(401);
    const me = await request(server())
      .get('/patient-api/me')
      .set('Authorization', `Bearer ${s1.accessToken}`)
      .expect(200);
    expect(me.body.data).toEqual({
      id: s1.account.id,
      fullName: null,
      email: 'patient.one@example.com',
      createdAt: expect.any(String),
    });

    const patched = await request(server())
      .patch('/patient-api/me')
      .set('Authorization', `Bearer ${s1.accessToken}`)
      .send({ fullName: 'Patient One' })
      .expect(200);
    expect(patched.body.data.fullName).toBe('Patient One');

    // Refresh rotates.
    const r1 = await request(server())
      .post('/patient-auth/refresh')
      .set('x-patient-refresh-token', s1.refreshToken)
      .expect(200);
    const s2 = r1.body.data;
    expect(s2.refreshToken).not.toBe(s1.refreshToken);
    expect(s2.needsName).toBe(false);

    // Old refresh token is rejected — and that reuse revokes the session.
    const reuse = await request(server())
      .post('/patient-auth/refresh')
      .set('x-patient-refresh-token', s1.refreshToken);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('SESSION_INVALID');

    const dead = await request(server())
      .post('/patient-auth/refresh')
      .set('x-patient-refresh-token', s2.refreshToken);
    expect(dead.status).toBe(401);
    // The access token of the revoked session no longer works either.
    await request(server())
      .get('/patient-api/me')
      .set('Authorization', `Bearer ${s2.accessToken}`)
      .expect(401);
  });

  it('a second sign-in reuses the account; logout kills the session', async () => {
    await start().expect(200);
    const code = sent.at(-1)!.code;
    const ok = await verify(code).expect(200);
    expect(ok.body.data.isNewAccount).toBe(false);

    await request(server())
      .post('/patient-auth/logout')
      .set('x-patient-refresh-token', ok.body.data.refreshToken)
      .expect(200);
    await request(server())
      .post('/patient-auth/refresh')
      .set('x-patient-refresh-token', ok.body.data.refreshToken)
      .expect(401);
  });

  it('a wrong code and an unknown email answer the same CODE_INVALID', async () => {
    const wrong = await verify('000000');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('CODE_INVALID');
    const unknown = await request(server())
      .post('/patient-auth/email/verify')
      .send({ email: 'nobody@example.com', code: '123456', ...versions });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe('CODE_INVALID');
  });
});
