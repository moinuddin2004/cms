import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AccessContext } from 'src/access/access-context';
import type { PermissionMap } from 'src/access/catalog/permissions';
import { patientScope } from 'src/patients/access/patient-scope';
import { itDatabaseUrl, itSsl } from '../billing/db.config';

/**
 * Runs the real `patientScope()` predicates through TypeORM + Postgres.
 * Only the columns the predicates read are created, in this suite's own
 * schema (created and dropped here; never `public`).
 */
const SCHEMA = 'mthreescope';

const ids = {
  docA: randomUUID(),
  docB: randomUUID(),
  locA: randomUUID(),
  locB: randomUUID(),
  sessA: randomUUID(), // doctor A, location A
  sessB: randomUUID(), // doctor B, location B
  pAppt: randomUUID(), // booked with doctor A at location B
  pQueue: randomUUID(), // walk-in in doctor A's queue (encounter) at location A
  pOther: randomUUID(), // doctor B only, registered at location B
  pRegA: randomUUID(), // registered at location A, never seen
};

function access(
  permissions: PermissionMap,
  employeeId: string | null = ids.docA,
) {
  return new AccessContext({
    userId: 'u1',
    organizationId: 'org1',
    locationId: ids.locA,
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId,
    features: [],
    permissions,
    roles: [],
    homeRoute: null,
  });
}

describe('patientScope (Postgres)', () => {
  let ds: DataSource;

  const visible = async (ctx: AccessContext) => {
    const qb = ds
      .createQueryBuilder()
      .select('p.id', 'id')
      .from('patients', 'p');
    ctx.applyScope(qb, 'patients.view', patientScope('p.id'));
    const rows = await qb.getRawMany<{ id: string }>();
    return rows.map((r) => r.id).sort();
  };

  beforeAll(async () => {
    const admin = new DataSource({
      type: 'postgres',
      url: itDatabaseUrl(),
      ssl: itSsl(),
    });
    await admin.initialize();
    await admin.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);
    await admin.destroy();

    ds = new DataSource({
      type: 'postgres',
      url: itDatabaseUrl(),
      ssl: itSsl(),
      extra: { options: `-c search_path=${SCHEMA}`, max: 2 },
    });
    await ds.initialize();
    await ds.query(`
      CREATE TABLE patients (id uuid PRIMARY KEY, primary_location_id uuid);
      CREATE TABLE appointments (id uuid PRIMARY KEY, patient_id uuid, doctor_id uuid, location_id uuid);
      CREATE TABLE queue_sessions (id uuid PRIMARY KEY, doctor_id uuid, location_id uuid);
      CREATE TABLE queue_entries (id uuid PRIMARY KEY, queue_session_id uuid, patient_id uuid);
    `);
    await ds.query(
      `INSERT INTO patients VALUES ($1, $5), ($2, $5), ($3, $6), ($4, $7)`,
      [
        ids.pAppt,
        ids.pQueue,
        ids.pOther,
        ids.pRegA,
        ids.locB,
        ids.locB,
        ids.locA,
      ],
    );
    await ds.query(
      `INSERT INTO appointments VALUES (gen_random_uuid(), $1, $2, $3), (gen_random_uuid(), $4, $5, $3)`,
      [ids.pAppt, ids.docA, ids.locB, ids.pOther, ids.docB],
    );
    await ds.query(
      `INSERT INTO queue_sessions VALUES ($1, $2, $3), ($4, $5, $6)`,
      [ids.sessA, ids.docA, ids.locA, ids.sessB, ids.docB, ids.locB],
    );
    await ds.query(
      `INSERT INTO queue_entries VALUES (gen_random_uuid(), $1, $2), (gen_random_uuid(), $3, $4)`,
      [ids.sessA, ids.pQueue, ids.sessB, ids.pOther],
    );
  }, 60000);

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
      await ds.destroy();
    }
  });

  it('own = patients with an appointment or a queue visit with this doctor', async () => {
    expect(await visible(access({ 'patients.view': 'own' }))).toEqual(
      [ids.pAppt, ids.pQueue].sort(),
    );
  });

  it('own for another doctor sees only theirs', async () => {
    expect(await visible(access({ 'patients.view': 'own' }, ids.docB))).toEqual(
      [ids.pOther],
    );
  });

  it('location = registered, booked or queued at the active location', async () => {
    // pRegA: registered at A; pQueue: queued at A. pAppt (booked at B) and pOther are not.
    expect(await visible(access({ 'patients.view': 'location' }))).toEqual(
      [ids.pQueue, ids.pRegA].sort(),
    );
  });

  it('org = everything', async () => {
    expect(await visible(access({ 'patients.view': 'org' }))).toHaveLength(4);
  });

  it('no grant → 0 rows; own without an employee → 0 rows', async () => {
    expect(await visible(access({}))).toEqual([]);
    expect(await visible(access({ 'patients.view': 'own' }, null))).toEqual([]);
  });

  it('binds the employee id as a parameter (no injection)', async () => {
    const evil = `' OR 1=1 --`;
    await expect(
      visible(access({ 'patients.view': 'own' }, evil)),
    ).rejects.toThrow(/invalid input syntax for type uuid/);
  });
});
