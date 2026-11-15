/*
 * Patient links + claim API — M2-04 integration spec. Runs ONLY on a local /
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
import { hashClaimToken } from 'src/patient-links/claim-token';
import { itDatabaseUrl, itSsl } from '../billing/db.config';
import { assertSafePatientTestDb } from './test-db-safety';

// Module level on purpose: a throw here fails the file before ANY hook runs.
assertSafePatientTestDb();

const SCHEMA = 'patientclaimit';
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

describe('patient links + claim API (int)', () => {
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

  async function signIn(email: string): Promise<{ token: string; id: string }> {
    await request(server()).post('/patient-auth/email/start').send({ email });
    const code = sent.filter((m) => m.email === email).at(-1)!.code;
    const res = await request(server())
      .post('/patient-auth/email/verify')
      .send({ email, code, ...versions })
      .expect(200);
    return { token: res.body.data.accessToken, id: res.body.data.account.id };
  }

  const createToken = async (patientId: string, orgId = org) =>
    (await staff.createClaimToken(patientId, ctx(orgId), actor)).data as {
      token: string;
      url: string;
      expiresAt: Date;
    };
  const status = async (patientId: string) =>
    (await staff.status(patientId, ctx(org))).data as any;
  const preview = (bearer: string, token: string) =>
    request(server())
      .get(`/patient-api/claims/${token}`)
      .set('Authorization', `Bearer ${bearer}`);
  const accept = (bearer: string, token: string, body: object) =>
    request(server())
      .post(`/patient-api/claims/${token}/accept`)
      .set('Authorization', `Bearer ${bearer}`)
      .send(body);

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

  it('full flow: create → preview → accept → status → reuse rejected → revoke', async () => {
    const owner = await signIn('owner@patients.test');
    const stranger = await signIn('stranger@patients.test');

    const created = await createToken(patients.ali);
    expect(created.url).toBe(`https://app.example.test/c/${created.token}`);
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(created.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Only the hash is stored.
    const stored = await runSql(
      `SELECT token_hash FROM patient_claim_tokens WHERE patient_id = $1`,
      [patients.ali],
    );
    expect(stored.rows).toEqual([
      { token_hash: hashClaimToken(created.token) },
    ]);
    expect(JSON.stringify(stored.rows)).not.toContain(created.token);

    expect((await status(patients.ali)).status).toBe('none');
    expect((await status(patients.ali)).pendingClaim).not.toBeNull();

    // Preview: masked, no full name / contact.
    await request(server())
      .get(`/patient-api/claims/${created.token}`)
      .expect(401);
    const pv = await preview(owner.token, created.token).expect(200);
    expect(pv.body.data).toEqual({
      clinic: {
        organizationId: org,
        name: 'Smile Clinic',
        logoUrl: null,
        brandColor: expect.any(String),
      },
      location: { name: expect.any(String) },
      maskedName: 'Ali R. K.',
      ageBand: '18-39',
      isMinor: false,
      alreadyLinkedToYou: false,
    });
    expect(JSON.stringify(pv.body)).not.toContain('Raza');

    // Unknown / malformed token → one error.
    const bad = await preview(owner.token, 'x'.repeat(43));
    expect(bad.status).toBe(404);
    expect(bad.body.error.code).toBe('CLAIM_INVALID');
    expect((await preview(owner.token, 'short')).status).toBe(404);

    // Accept needs explicit consent.
    const noConfirm = await accept(owner.token, created.token, {
      relation: 'self',
    });
    expect(noConfirm.status).toBe(400);

    const ok = await accept(owner.token, created.token, {
      relation: 'self',
      confirm: true,
    }).expect(200);
    expect(ok.body.data.profile).toMatchObject({
      relation: 'self',
      isSelf: true,
    });
    expect(ok.body.data.link).toMatchObject({
      profileId: ok.body.data.profile.id,
      status: 'active',
      linkMethod: 'staff_qr',
    });
    expect(ok.body.data.link.clinic.organizationId).toBe(org);

    // Single use — even for the same account, and for anyone else.
    const reuse = await accept(owner.token, created.token, {
      relation: 'self',
      confirm: true,
    });
    expect(reuse.status).toBe(404);
    expect(reuse.body.error.code).toBe('CLAIM_INVALID');
    expect((await preview(stranger.token, created.token)).status).toBe(404);

    // Staff status + a new token for a linked patient is refused.
    const st = await status(patients.ali);
    expect(st.status).toBe('active');
    expect(st.link).toMatchObject({
      maskedEmail: 'o***@patients.test',
      relation: 'self',
      linkMethod: 'staff_qr',
    });
    expect(st.pendingClaim).toBeNull();
    await expect(createToken(patients.ali)).rejects.toMatchObject({
      response: { code: 'ALREADY_LINKED' },
    });

    // Consent + access log + audit + realtime outbox were written.
    const consent = await runSql(
      `SELECT kind, organization_id FROM patient_account_consents WHERE kind = 'link'`,
    );
    expect(consent.rows).toEqual([{ kind: 'link', organization_id: org }]);
    const log = await runSql(
      `SELECT action FROM patient_access_log WHERE patient_id = $1`,
      [patients.ali],
    );
    expect(log.rows).toEqual([{ action: 'link' }]);
    const audit = await runSql(
      `SELECT entity_type, action FROM audit_logs
        WHERE subject_id = $1 ORDER BY created_at`,
      [patients.ali],
    );
    expect(audit.rows).toEqual([
      { entity_type: 'patient_app_claim', action: 'create' },
      { entity_type: 'patient_app_link', action: 'create' },
    ]);
    const ob = await runSql(
      `SELECT topic, payload FROM outbox WHERE topic = $1`,
      [`patient:${owner.id}`],
    );
    expect(ob.rows).toHaveLength(1);
    expect(ob.rows[0].payload).toMatchObject({
      type: 'feed.changed',
      kinds: ['links'],
      event: 'patient.record_linked',
    });

    // The new link shows up in the patient's own context.
    const me = await request(server())
      .get('/patient-api/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(me.body.data.email).toBe('owner@patients.test');

    // Revoke.
    expect(
      (
        await staff.revoke(
          patients.ali,
          { reason: 'Wrong person' },
          ctx(org),
          actor,
        )
      ).data,
    ).toEqual({ revoked: true });
    expect((await status(patients.ali)).status).toBe('none');
    const link = await runSql(
      `SELECT status, revoked_by_type, revoked_by_id, revoke_reason
         FROM patient_record_links WHERE patient_id = $1`,
      [patients.ali],
    );
    expect(link.rows).toEqual([
      {
        status: 'revoked',
        revoked_by_type: 'clinic',
        revoked_by_id: staffUser,
        revoke_reason: 'Wrong person',
      },
    ]);
    await expect(
      staff.revoke(patients.ali, {}, ctx(org), actor),
    ).rejects.toMatchObject({ response: { code: 'NOT_LINKED' } });
    const events = await runSql(
      `SELECT payload->>'event' AS event FROM outbox WHERE topic = $1 ORDER BY id`,
      [`patient:${owner.id}`],
    );
    expect(events.rows.map((r) => r.event)).toEqual([
      'patient.record_linked',
      'patient.link_revoked',
    ]);

    // After a revoke the record can be linked again (by someone else).
    const again = await createToken(patients.ali);
    await accept(stranger.token, again.token, {
      relation: 'self',
      confirm: true,
    }).expect(200);
  });

  it('a new token invalidates older unused ones; an expired token is refused', async () => {
    const acc = await signIn('second@patients.test');
    const first = await createToken(patients.sara);
    const second = await createToken(patients.sara);
    expect((await preview(acc.token, first.token)).status).toBe(404);
    expect((await preview(acc.token, second.token)).status).toBe(200);

    await runSql(
      `UPDATE patient_claim_tokens SET expires_at = now() - interval '1 minute'
        WHERE token_hash = $1`,
      [hashClaimToken(second.token)],
    );
    const expired = await accept(acc.token, second.token, {
      relation: 'self',
      confirm: true,
    });
    expect(expired.status).toBe(404);
    expect(expired.body.error.code).toBe('CLAIM_INVALID');
  });

  it('a dependent: child profile needs a name; another account cannot take a held record', async () => {
    const parent = await signIn('parent@patients.test');
    const other = await signIn('other@patients.test');
    const t = await createToken(patients.kid);

    const pv = await preview(parent.token, t.token).expect(200);
    expect(pv.body.data).toMatchObject({ isMinor: true, ageBand: '0-12' });

    const noName = await accept(parent.token, t.token, {
      relation: 'child',
      confirm: true,
    });
    expect(noName.status).toBe(400);
    expect(noName.body.error.code).toBe('NAME_REQUIRED');

    const ok = await accept(parent.token, t.token, {
      relation: 'child',
      newProfileName: 'Zain',
      confirm: true,
    }).expect(200);
    expect(ok.body.data.profile).toMatchObject({
      relation: 'child',
      fullName: 'Zain',
      isSelf: false,
    });

    // Race-ish: a token minted before the link existed cannot link it twice.
    await runSql(
      `INSERT INTO patient_claim_tokens (organization_id, patient_id, token_hash, created_by_user_id, expires_at)
       VALUES ($1, $2, $3, $4, now() + interval '10 minutes')`,
      [org, patients.kid, hashClaimToken('k'.repeat(43)), staffUser],
    );
    const dup = await accept(other.token, 'k'.repeat(43), {
      relation: 'self',
      confirm: true,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_LINKED');

    // A foreign profileId is a 404.
    const t2 = await createToken(patients.sara);
    const foreign = await accept(other.token, t2.token, {
      relation: 'child',
      profileId: ok.body.data.profile.id,
      confirm: true,
    });
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe('NOT_FOUND');
  });

  it('A-19: never-approved clinic reads as invalid; suspended clinic is refused', async () => {
    const acc = await signIn('gate@patients.test');

    // Mint tokens straight in the DB: a pending/suspended clinic cannot mint through the API.
    const mint = async (orgId: string, patientId: string, raw: string) =>
      runSql(
        `INSERT INTO patient_claim_tokens (organization_id, patient_id, token_hash, created_by_user_id, expires_at)
         VALUES ($1, $2, $3, $4, now() + interval '10 minutes')`,
        [orgId, patientId, hashClaimToken(raw), staffUser],
      );
    await mint(pendingOrg, patients.pend, 'p'.repeat(43));
    await mint(suspendedOrg, patients.susp, 's'.repeat(43));

    const pending = await preview(acc.token, 'p'.repeat(43));
    expect(pending.status).toBe(404);
    expect(pending.body.error.code).toBe('CLAIM_INVALID');
    expect(
      (
        await accept(acc.token, 'p'.repeat(43), {
          relation: 'self',
          confirm: true,
        })
      ).status,
    ).toBe(404);

    const susp = await preview(acc.token, 's'.repeat(43));
    expect(susp.status).toBe(403);
    expect(susp.body.error.code).toBe('CLINIC_SUSPENDED');
    expect(
      (
        await accept(acc.token, 's'.repeat(43), {
          relation: 'self',
          confirm: true,
        })
      ).status,
    ).toBe(403);

    await expect(
      createToken(patients.susp, suspendedOrg),
    ).rejects.toMatchObject({ response: { code: 'CLINIC_SUSPENDED' } });
    await expect(createToken(patients.pend, pendingOrg)).rejects.toMatchObject({
      response: { code: 'CLINIC_NOT_APPROVED' },
    });
  });

  it('a patient of another clinic cannot get a token (404)', async () => {
    await expect(createToken(patients.susp, org)).rejects.toMatchObject({
      status: 404,
    });
  });
});
