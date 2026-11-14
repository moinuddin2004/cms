/*
 * Patient link isolation — M2-03 integration spec. Runs ONLY on a local /
 * explicit disposable Postgres (`assertSafePatientTestDb`), in its own schema.
 *
 * Two clinics, two clinic patients, two patient accounts (A linked to
 * org1/patient1, B linked to org2/patient2). A TEST-ONLY controller, declared in
 * this spec (never in `src/`), lists `patients` through `linkedPatientWhere`.
 * The real PatientJwtGuard + PatientLinkGuard run, so this proves the whole wall
 * from access token to SQL predicate.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { resetRateLimits } from 'src/auth/guards/rate-limiter.guard';
import { UUID_V7_FUNCTION_SQL } from 'src/common/database/uuid-v7';
import { GlobalExceptionFilter } from 'src/common/exceptions/HttpExceptionHandler';
import { AppLogger } from 'src/common/services/logger.service';
import { MailService } from 'src/common/services/mail.service';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { Patient } from 'src/patients/entities/patient.entity';
import {
  assertProfile,
  linkedPatientWhere,
  PatientContext,
  PatientCtx,
} from 'src/patient-app/context/patient-context';
import { PatientApi } from 'src/patient-app/decorators/patient-api.decorator';
import { PatientAppModule } from 'src/patient-app/patient-app.module';
import { itDatabaseUrl, itSsl } from '../billing/db.config';
import { assertSafePatientTestDb } from './test-db-safety';

const SCHEMA = 'patientlinkit';
jest.setTimeout(180_000);

/** Test-only: lists clinic patients through the link wall. */
@Controller('patient-api/__isolation')
@PatientApi()
class IsolationController {
  constructor(
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
  ) {}

  @Get('patients')
  async list(
    @PatientCtx() ctx: PatientContext,
    @Query('profileId') profileId?: string,
    @Query('strict') strict?: string,
    @Query('includeFrozen') includeFrozen?: string,
  ) {
    if (strict === '1' && profileId) assertProfile(ctx, profileId);
    const qb = this.patients.createQueryBuilder('patient').select('patient.id');
    linkedPatientWhere(qb, ctx, {
      alias: 'patient',
      orgColumn: 'organization_id',
      patientColumn: 'id',
      profileId,
      includeFrozen: includeFrozen !== '0',
    });
    return (await qb.orderBy('patient.id').getMany()).map((p) => p.id);
  }
}

@Module({
  imports: [
    PatientAppModule,
    FeatureFlagsModule,
    TypeOrmModule.forFeature([Patient]),
  ],
  controllers: [IsolationController],
})
class IsolationTestModule {}

async function withClient<T>(
  fn: (client: Client) => Promise<T>,
  schema?: string,
): Promise<T> {
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    if (schema) await client.query(`SET search_path TO ${schema},public`);
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Runs in the spec's own schema. */
const runSql = (sql: string, params: unknown[] = []) =>
  withClient((c) => c.query(sql, params), SCHEMA);
/** Database-wide statements (extensions, schema create/drop). */
const runRaw = (sql: string) => withClient((c) => c.query(sql));

describe('patient link isolation (int)', () => {
  let app: INestApplication;
  const sent: { email: string; code: string }[] = [];
  const server = () => app.getHttpServer() as App;
  const versions = { termsVersion: '1.0', privacyVersion: '1.0' };

  const org1 = randomUUID();
  const org2 = randomUUID();
  const patient1 = randomUUID();
  const patient2 = randomUUID();
  const profileA = randomUUID();
  const profileB = randomUUID();
  const linkA = randomUUID();
  const linkB = randomUUID();
  let tokenA = '';
  let tokenB = '';

  async function signIn(email: string): Promise<{ token: string; id: string }> {
    await request(server()).post('/patient-auth/email/start').send({ email });
    const code = sent.filter((m) => m.email === email).at(-1)!.code;
    const res = await request(server())
      .post('/patient-auth/email/verify')
      .send({ email, code, ...versions })
      .expect(200);
    return { token: res.body.data.accessToken, id: res.body.data.account.id };
  }

  const list = (token: string, query: Record<string, string> = {}) =>
    request(server())
      .get('/patient-api/__isolation/patients')
      .query(query)
      .set('Authorization', `Bearer ${token}`);

  // The test controller returns a bare array; the response wrapper may or may
  // not envelope it — accept both shapes.
  const ids = (res: request.Response): string[] => res.body.data ?? res.body;

  beforeAll(async () => {
    assertSafePatientTestDb();
    process.env.JWT_ACCESS_SECRET ??= 'link-isolation-it-staff-secret';
    process.env.JWT_PATIENT_ACCESS_SECRET = 'link-isolation-it-patient-secret';

    await runRaw('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await runRaw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await runRaw(UUID_V7_FUNCTION_SQL);
    await runRaw(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await runRaw(`CREATE SCHEMA ${SCHEMA}`);

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
        IsolationTestModule,
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

    // Partial / expression indexes synchronize cannot create (08 §7).
    await runSql(
      readFileSync(
        join(
          __dirname,
          '../../database/changes/2026-11-12_patient_identity.sql',
        ),
        'utf8',
      ),
    );

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

    // Two clinics with one patient each.
    for (const [org, slug] of [
      [org1, 'clinic-one'],
      [org2, 'clinic-two'],
    ]) {
      await runSql(
        'INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)',
        [org, slug, `${slug}-${org.slice(0, 8)}`],
      );
    }
    for (const [pid, org, n] of [
      [patient1, org1, 'P-1'],
      [patient2, org2, 'P-2'],
    ]) {
      await runSql(
        'INSERT INTO patients (id, organization_id, patient_number, full_name, phone) VALUES ($1, $2, $3, $4, $5)',
        [pid, org, n, `Patient ${n}`, '03000000000'],
      );
    }

    // Two patient accounts through the real sign-in flow.
    const a = await signIn('a@patients.test');
    resetRateLimits();
    const b = await signIn('b@patients.test');
    tokenA = a.token;
    tokenB = b.token;
    for (const [pid, acc] of [
      [profileA, a.id],
      [profileB, b.id],
    ]) {
      await runSql(
        `INSERT INTO patient_profiles (id, account_id, relation, full_name) VALUES ($1, $2, 'self', 'Self')`,
        [pid, acc],
      );
    }
    const linkSql = `INSERT INTO patient_record_links (id, profile_id, organization_id, patient_id) VALUES ($1, $2, $3, $4)`;
    await runSql(linkSql, [linkA, profileA, org1, patient1]);
    await runSql(linkSql, [linkB, profileB, org2, patient2]);
  });

  beforeEach(() => resetRateLimits());

  afterAll(async () => {
    await app?.close();
    await runRaw(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  });

  it('each account sees only its own linked patient', async () => {
    expect(ids(await list(tokenA).expect(200))).toEqual([patient1]);
    expect(ids(await list(tokenB).expect(200))).toEqual([patient2]);
  });

  it('a foreign profile filter returns nothing (or 404 through assertProfile)', async () => {
    expect(
      ids(await list(tokenA, { profileId: profileB }).expect(200)),
    ).toEqual([]);
    const res = await list(tokenA, { profileId: profileB, strict: '1' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    // Own profile still works.
    expect(
      ids(await list(tokenA, { profileId: profileA, strict: '1' }).expect(200)),
    ).toEqual([patient1]);
  });

  it('a frozen link stays visible; a revoked link disappears', async () => {
    await runSql(
      `UPDATE patient_record_links SET status = 'frozen' WHERE id = $1`,
      [linkA],
    );
    expect(ids(await list(tokenA).expect(200))).toEqual([patient1]);
    expect(ids(await list(tokenA, { includeFrozen: '0' }).expect(200))).toEqual(
      [],
    );

    await runSql(
      `UPDATE patient_record_links SET status = 'revoked', revoked_at = now() WHERE id = $1`,
      [linkA],
    );
    expect(ids(await list(tokenA).expect(200))).toEqual([]);
    // B is unaffected.
    expect(ids(await list(tokenB).expect(200))).toEqual([patient2]);

    await runSql(
      `UPDATE patient_record_links SET status = 'active', revoked_at = NULL WHERE id = $1`,
      [linkA],
    );
    expect(ids(await list(tokenA).expect(200))).toEqual([patient1]);
  });

  it('no token or a bad token never reaches the controller', async () => {
    await request(server())
      .get('/patient-api/__isolation/patients')
      .expect(401);
    await list('not-a-token').expect(401);
  });
});
