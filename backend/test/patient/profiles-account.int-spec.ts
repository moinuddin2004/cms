/*
 * Patient profiles, unlinking and account deletion — M2-10 / M2-11 integration spec. Runs ONLY on a local /
 * disposable Postgres (`assertSafePatientTestDb`), in its own schema.
 *
 * Patient side = real HTTP (sign-in, preview, accept, /me). Staff side calls
 * `PatientLinksController` methods directly: the staff guard chain (JWT,
 * tenant, `@Can`) is covered by its own specs and the access-coverage spec,
 * and a full staff login harness is out of scope for this card.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
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
import { ActorSide } from 'src/common/audit/audit.enums';
import { UUID_V7_FUNCTION_SQL } from 'src/common/database/uuid-v7';
import { GlobalExceptionFilter } from 'src/common/exceptions/HttpExceptionHandler';
import { AppLogger } from 'src/common/services/logger.service';
import { MailService } from 'src/common/services/mail.service';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { PatientLinksController } from 'src/patient-links/patient-links.controller';
import { itDatabaseUrl, itSsl } from '../billing/db.config';
import { assertSafePatientTestDb } from './test-db-safety';

// Module level on purpose: a throw here fails the file before ANY hook runs.
assertSafePatientTestDb();

const SCHEMA = 'patientprofilesit';
jest.setTimeout(180_000);

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
const runSql = (
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: any[] }> => withClient((c) => c.query(sql, params), SCHEMA);
const runRaw = (sql: string) => withClient((c) => c.query(sql));

describe('patient profiles + links + account deletion (int)', () => {
  let app: INestApplication;
  let staff: PatientLinksController;
  const sent: { email: string; code: string }[] = [];
  const server = () => app.getHttpServer() as App;
  const versions = { termsVersion: '1.0', privacyVersion: '1.0' };

  const org = randomUUID();
  const suspendedOrg = randomUUID();
  const pendingOrg = randomUUID();
  const staffUser = randomUUID();
  const actor = {
    userId: staffUser,
    side: ActorSide.CLINIC,
    ip: null,
    requestId: null,
  };
  const ctx = (organizationId: string) => ({
    organizationId,
    locationId: randomUUID(),
  });
  const patients = {
    ali: randomUUID(),
    sara: randomUUID(),
    kid: randomUUID(),
    susp: randomUUID(),
    pend: randomUUID(),
  };

  async function signIn(
    email: string,
  ): Promise<{ token: string; id: string; isNew: boolean }> {
    await request(server()).post('/patient-auth/email/start').send({ email });
    const code = sent.filter((m) => m.email === email).at(-1)!.code;
    const res = await request(server())
      .post('/patient-auth/email/verify')
      .send({ email, code, ...versions })
      .expect(200);
    return {
      token: res.body.data.accessToken,
      id: res.body.data.account.id,
      isNew: res.body.data.isNewAccount,
    };
  }
  /** Resolves to the accept response; `.expect(status)` asserts and returns it. */
  const claim = (bearer: string, patientId: string, body: object) => {
    const done = (async () => {
      const t = (await staff.createClaimToken(patientId, ctx(org), actor))
        .data as { token: string };
      return request(server())
        .post(`/patient-api/claims/${t.token}/accept`)
        .set('Authorization', `Bearer ${bearer}`)
        .send({ confirm: true, ...body });
    })();
    return Object.assign(done, {
      expect: async (status: number) => {
        const res = await done;
        expect(res.status).toBe(status);
        return res;
      },
    });
  };
  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    bearer: string,
  ) => request(server())[method](path).set('Authorization', `Bearer ${bearer}`);

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET ??= 'patient-claim-it-staff-secret';
    process.env.JWT_PATIENT_ACCESS_SECRET = 'patient-claim-it-patient-secret';
    process.env.FRONTEND_URL = 'https://app.example.test';

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
    staff = app.get(PatientLinksController);

    for (const [id, name, active, approval] of [
      [org, 'Smile Clinic', true, 'approved'],
      [suspendedOrg, 'Suspended Clinic', false, 'approved'],
      [pendingOrg, 'Pending Clinic', true, 'pending'],
    ] as const) {
      await runSql(
        `INSERT INTO organizations (id, name, slug, is_active, approval_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, name, `${name}-${id.slice(0, 8)}`, active, approval],
      );
      await runSql(
        `INSERT INTO org_feature_flags (organization_id, feature_key, is_enabled, is_entitled)
         VALUES ($1, 'patient_app', true, true)`,
        [id],
      );
    }
    app.get(FeatureFlagsService).invalidateCache(org);
    app.get(FeatureFlagsService).invalidateCache(suspendedOrg);
    app.get(FeatureFlagsService).invalidateCache(pendingOrg);

    const insertPatient = (
      id: string,
      orgId: string,
      n: string,
      name: string,
      dob: string | null,
      minor = false,
    ) =>
      runSql(
        `INSERT INTO patients (id, organization_id, patient_number, full_name, phone, dob, is_minor)
         VALUES ($1, $2, $3, $4, '03000000000', $5, $6)`,
        [id, orgId, n, name, dob, minor],
      );
    await insertPatient(
      patients.ali,
      org,
      'P-1',
      'Ali Raza Khan',
      '1990-05-05',
    );
    await insertPatient(patients.sara, org, 'P-2', 'Sara Noor', '1985-01-01');
    await insertPatient(
      patients.kid,
      org,
      'P-3',
      'Zain Khan',
      '2018-03-03',
      true,
    );
    await insertPatient(patients.susp, suspendedOrg, 'P-4', 'Sam Susp', null);
    await insertPatient(patients.pend, pendingOrg, 'P-5', 'Pam Pend', null);
  });

  beforeEach(() => resetRateLimits());

  afterAll(async () => {
    await app?.close();
    await runRaw(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  });

  it('profiles: create, edit, list with links, remove rules', async () => {
    const me = await signIn('family@patients.test');
    await api('get', '/patient-api/profiles', me.token).expect(200);

    const self = await claim(me.token, patients.ali, {
      relation: 'self',
    }).expect(200);
    const child = await api('post', '/patient-api/profiles', me.token)
      .send({ relation: 'child', fullName: '  Zain Khan ', dob: '2018-03-03' })
      .expect(201);
    expect(child.body.data).toMatchObject({
      relation: 'child',
      fullName: 'Zain Khan',
      dob: '2018-03-03',
      isSelf: false,
      links: [],
    });
    await api('post', '/patient-api/profiles', me.token)
      .send({ relation: 'self', fullName: 'X' })
      .expect(400);
    await api('post', '/patient-api/profiles', me.token)
      .send({ relation: 'child', fullName: 'X', dob: '2999-01-01' })
      .expect(400);
    await api('post', '/patient-api/profiles', me.token)
      .send({ relation: 'child', fullName: 'X', accountId: randomUUID() })
      .expect(400);

    await claim(me.token, patients.kid, {
      relation: 'child',
      profileId: child.body.data.id,
    }).expect(200);

    const list = await api('get', '/patient-api/profiles', me.token).expect(
      200,
    );
    expect(list.body.data.map((p: any) => p.relation)).toEqual([
      'self',
      'child',
    ]);
    const kid = list.body.data.find((p: any) => p.relation === 'child');
    expect(kid.links).toHaveLength(1);
    expect(kid.links[0].clinic.organizationId).toBe(org);
    expect(JSON.stringify(list.body)).not.toContain('private');

    const edited = await api(
      'patch',
      `/patient-api/profiles/${kid.id}`,
      me.token,
    )
      .send({ fullName: 'Zain K.', relation: 'other', dob: null })
      .expect(200);
    expect(edited.body.data).toMatchObject({
      fullName: 'Zain K.',
      relation: 'other',
      dob: null,
    });
    expect(edited.body.data.links).toHaveLength(1);
    await api(
      'patch',
      `/patient-api/profiles/${self.body.data.profile.id}`,
      me.token,
    )
      .send({ relation: 'child' })
      .expect(400);

    await api(
      'delete',
      `/patient-api/profiles/${self.body.data.profile.id}`,
      me.token,
    ).expect(400);
    const blocked = await api(
      'delete',
      `/patient-api/profiles/${kid.id}`,
      me.token,
    );
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PROFILE_HAS_LINKS');
    await api(
      'delete',
      `/patient-api/links/${kid.links[0].id}`,
      me.token,
    ).expect(200);
    await api('delete', `/patient-api/profiles/${kid.id}`, me.token).expect(
      200,
    );
  });

  it('profiles + links never cross accounts', async () => {
    const a = await signIn('a@patients.test');
    const b = await signIn('b@patients.test');
    const linkA = await claim(a.token, patients.sara, {
      relation: 'self',
    }).expect(200);
    const profileA = linkA.body.data.profile.id;
    const linkIdA = linkA.body.data.link.id;

    await api('patch', `/patient-api/profiles/${profileA}`, b.token)
      .send({ fullName: 'Hacked' })
      .expect(404);
    await api('delete', `/patient-api/profiles/${profileA}`, b.token).expect(
      404,
    );
    await api('delete', `/patient-api/links/${linkIdA}`, b.token).expect(404);
    await api('get', `/patient-api/links/${linkIdA}/history`, b.token).expect(
      404,
    );
    const bLinks = await api('get', '/patient-api/links', b.token).expect(200);
    expect(bLinks.body.data).toEqual([]);
  });

  it('unlink: patient-side revoke is audited, frees the record, shows in history', async () => {
    const me = await signIn('unlink@patients.test');
    const ok = await claim(me.token, patients.ali, {
      relation: 'self',
    }).expect(200);
    const linkId = ok.body.data.link.id;

    const links = await api('get', '/patient-api/links', me.token).expect(200);
    expect(links.body.data).toHaveLength(1);
    expect(links.body.data[0]).toMatchObject({
      id: linkId,
      status: 'active',
      revokedAt: null,
    });

    await api('delete', `/patient-api/links/${linkId}`, me.token).expect(200);
    await api('delete', `/patient-api/links/${linkId}`, me.token).expect(404);

    const after = await api('get', '/patient-api/links', me.token).expect(200);
    expect(after.body.data[0]).toMatchObject({
      id: linkId,
      status: 'revoked',
      revokedBy: 'patient',
    });
    const hist = await api(
      'get',
      `/patient-api/links/${linkId}/history`,
      me.token,
    ).expect(200);
    expect(hist.body.data.map((h: any) => h.action)).toEqual([
      'unlinked_by_you',
      'linked',
    ]);

    expect(
      ((await staff.status(patients.ali, ctx(org))).data as any).status,
    ).toBe('none');
    const audit = await runSql(
      `SELECT changes FROM audit_logs WHERE entity_type = 'patient_app_link' AND entity_id = $1`,
      [linkId],
    );
    expect(JSON.stringify(audit.rows)).toContain('"revokedBy":"patient"');
    const log = await runSql(
      `SELECT action FROM patient_access_log WHERE resource_id = $1`,
      [linkId],
    );
    expect(log.rows.map((r) => r.action)).toContain('unlink');
    const outbox = await runSql(
      `SELECT payload FROM outbox WHERE payload->>'linkId' = $1 AND payload->>'event' = 'patient.link_revoked'`,
      [linkId],
    );
    expect(outbox.rows).toHaveLength(1);

    const other = await signIn('other@patients.test');
    await claim(other.token, patients.ali, { relation: 'self' }).expect(200);
  });

  it('delete account: revokes links + sessions, removes identities, re-sign-up is fresh', async () => {
    const email = 'goodbye@patients.test';
    const me = await signIn(email);
    const linked = await claim(me.token, patients.kid, {
      relation: 'child',
      newProfileName: 'Zain',
    }).expect(200);
    const linkId = linked.body.data.link.id;

    await api('delete', '/patient-api/me', me.token).send({}).expect(400);
    await api('delete', '/patient-api/me', me.token)
      .send({ confirm: 'delete' })
      .expect(400);
    await api('delete', '/patient-api/me', me.token)
      .send({ confirm: 'DELETE' })
      .expect(200);

    await api('get', '/patient-api/me', me.token).expect(401);

    const q = async (sql: string) => (await runSql(sql, [me.id])).rows;
    expect(
      await q(`SELECT 1 FROM patient_account_identities WHERE account_id = $1`),
    ).toHaveLength(0);
    // profiles are soft-deleted with their data stripped; the revoked link rows stay
    expect(
      await q(
        `SELECT 1 FROM patient_profiles WHERE account_id = $1 AND deleted_at IS NULL`,
      ),
    ).toHaveLength(0);
    const stripped = await q(
      `SELECT full_name, dob, gender FROM patient_profiles WHERE account_id = $1`,
    );
    expect(stripped.length).toBeGreaterThan(0);
    expect(JSON.stringify(stripped)).not.toContain('Zain');
    expect(
      await q(
        `SELECT 1 FROM patient_record_links l JOIN patient_profiles p ON p.id = l.profile_id
          WHERE p.account_id = $1 AND l.status = 'revoked' AND l.revoked_by_type = 'patient'`,
      ),
    ).toHaveLength(1);
    expect(
      await q(
        `SELECT 1 FROM patient_sessions WHERE account_id = $1 AND revoked_at IS NULL`,
      ),
    ).toHaveLength(0);
    const acct = (
      await q(
        `SELECT status, deleted_at, full_name, email FROM patient_accounts WHERE id = $1`,
      )
    )[0];
    expect(acct.status).toBe('deleted');
    expect(acct.deleted_at).not.toBeNull();
    expect(acct.full_name).toBeNull();
    expect(acct.email).not.toContain('goodbye');

    expect(
      ((await staff.status(patients.kid, ctx(org))).data as any).status,
    ).toBe('none');
    const audit = await runSql(
      `SELECT 1 FROM audit_logs WHERE entity_type = 'patient_app_link' AND entity_id = $1`,
      [linkId],
    );
    expect(audit.rows.length).toBeGreaterThan(0);
    expect(
      await q(
        `SELECT 1 FROM patient_access_log WHERE account_id = $1 AND action = 'unlink'`,
      ),
    ).toHaveLength(1);

    const again = await signIn(email);
    expect(again.isNew).toBe(true);
    expect(again.id).not.toBe(me.id);
    const profiles = await api(
      'get',
      '/patient-api/profiles',
      again.token,
    ).expect(200);
    expect(profiles.body.data).toEqual([]);
  });
});
