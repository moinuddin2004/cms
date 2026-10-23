import { randomUUID } from 'crypto';
import type * as request from 'supertest';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { addStaff, bootApp, dataOf, Env, seedWorld } from './harness';
import { LabSeed, seedLab } from './lab-fixture';

/** First array in a (possibly paginated) response body. */
function rowsOf(res: request.Response): Record<string, unknown>[] {
  const d = dataOf<unknown>(res);
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  const obj = d as Record<string, unknown>;
  for (const k of ['data', 'items', 'results', 'rows']) {
    if (Array.isArray(obj[k])) return obj[k] as Record<string, unknown>[];
  }
  const first = Object.values(obj).find(Array.isArray);
  return (first as Record<string, unknown>[]) ?? [];
}
const idsOf = (res: request.Response) => rowsOf(res).map((r) => r.id as string);

/** Section 5 — Scope: own / location / org (AC-SCOPE). */
describe('AC-SCOPE scope', () => {
  let env: Env;
  let w: Env['world'];
  let lab: LabSeed;
  let inv: { l1: string; l2: string };

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'scope');
    // An appointment of Doc2 (P2) so Doc1's list has something to exclude.
    const start = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    await env.ds.getRepository(Appointment).save({
      organizationId: w.orgA,
      locationId: w.L1,
      patientId: w.patients.P2,
      doctorId: w.people.Doc2.employeeId!,
      startTime: start,
      endTime: new Date(start.getTime() + 30 * 60 * 1000),
      durationMinutes: 30,
    } as Partial<Appointment>);

    const mkInvoice = async (loc: string, patientId: string, tag: string) => {
      const id = randomUUID();
      await env.ds.query(
        `INSERT INTO invoices (id, organization_id, location_id, patient_id, invoice_number, issue_date, issued_at, due_date, issued_by)
         VALUES ($1,$2,$3,$4,$5, CURRENT_DATE, now(), CURRENT_DATE, $6)`,
        [id, w.orgA, loc, patientId, `ACC-${tag}-${randomUUID().slice(0, 6)}`, w.people.OwnerA.userId],
      );
      return id;
    };
    inv = {
      l1: await mkInvoice(w.L1, w.patients.P1, 'L1'),
      l2: await mkInvoice(w.L2, w.patients.P3, 'L2'),
    };
    lab = await seedLab(env);
  }, 900_000);
  afterAll(async () => env?.close());

  it('SCOPE-01 patients own: Doc1 sees P1, not P2 / P3', async () => {
    const ids = idsOf(await env.get('/patients?limit=100', w.people.Doc1).expect(200));
    expect(ids).toContain(w.patients.P1);
    expect(ids).not.toContain(w.patients.P2);
    expect(ids).not.toContain(w.patients.P3);
  });

  it('SCOPE-02 patients own via encounter: Doc2 sees P2', async () => {
    const ids = idsOf(await env.get('/patients?limit=100', w.people.Doc2).expect(200));
    expect(ids).toContain(w.patients.P2);
    expect(ids).not.toContain(w.patients.P1);
  });

  it('SCOPE-03 out-of-scope detail: Doc1 → P2 is 404 (no leak)', async () => {
    const res = await env.get(`/patients/${w.patients.P2}`, w.people.Doc1);
    expect([403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toContain('Patient Two');
    await env.get(`/patients/${w.patients.P1}`, w.people.Doc1).expect(200);
  });

  it('SCOPE-04 patients location: RecU (L1) sees L1 patients only', async () => {
    const ids = idsOf(await env.get('/patients?limit=100', w.people.RecU).expect(200));
    expect(ids).toEqual(expect.arrayContaining([w.patients.P1, w.patients.P2]));
    expect(ids).not.toContain(w.patients.P3);
  });

  it('SCOPE-05 patients org: AdminU sees all OrgA patients, none of OrgB', async () => {
    const ids = idsOf(await env.get('/patients?limit=100', w.people.AdminU).expect(200));
    expect(ids).toEqual(
      expect.arrayContaining([w.patients.P1, w.patients.P2, w.patients.P3]),
    );
    expect(ids).not.toContain(w.patients.PB);
  });

  it('SCOPE-06 appointments own: Doc1 sees only Doc1\'s', async () => {
    const rows = rowsOf(await env.get('/appointments?limit=100', w.people.Doc1).expect(200));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const doctorId = (r.doctorId ?? (r.doctor as { id?: string } | undefined)?.id) as string;
      expect(doctorId).toBe(w.people.Doc1.employeeId);
    }
    const asAdmin = rowsOf(await env.get('/appointments?limit=100', w.people.AdminU).expect(200));
    const doctors = new Set(
      asAdmin.map((r) => (r.doctorId ?? (r.doctor as { id?: string } | undefined)?.id) as string),
    );
    expect(doctors.size).toBeGreaterThan(1);
  });

  it('SCOPE-07 lab orders own: Doc1 sees only own; another doctor\'s order is 404', async () => {
    const ids = idsOf(await env.get('/lab-orders?limit=100', w.people.Doc1).expect(200));
    expect(ids).toContain(lab.orders.doc1);
    expect(ids).not.toContain(lab.orders.doc2);
    await env.get(`/lab-orders/${lab.orders.doc2}`, w.people.Doc1).expect(404);
    await env.get(`/lab-orders/${lab.orders.doc1}`, w.people.Doc1).expect(200);
    // Location scope (Receptionist) sees both.
    const rec = idsOf(await env.get('/lab-orders?limit=100', w.people.RecU).expect(200));
    expect(rec).toEqual(expect.arrayContaining([lab.orders.doc1, lab.orders.doc2]));
  });

  it('SCOPE-08 invoices location: AcctU (L1) lists L1 only', async () => {
    const ids = idsOf(await env.get('/invoices?limit=100', w.people.AcctU).expect(200));
    expect(ids).toContain(inv.l1);
    expect(ids).not.toContain(inv.l2);
  });

  it('SCOPE-09 reports cross-location: AcctU refused all-locations; AdminU gets it', async () => {
    const acct = await env.get('/reports/finance/overview?scope=organization', w.people.AcctU);
    expect(acct.status).toBe(403);
    await env.get('/reports/finance/overview', w.people.AcctU).expect(200);
    await env
      .get('/reports/finance/overview?scope=organization', w.people.AdminU)
      .expect(200);
  });

  it('SCOPE-10 clinic overview with own scope → 403', async () => {
    await env.get('/reports/clinic/overview', w.people.Doc1).expect(403);
    await env.get('/reports/clinic/overview', w.people.AdminU).expect(200);
  });

  it('SCOPE-11 no grant → 403 (guard)', async () => {
    const { person } = await addStaff(env, 'NoPatientView', {
      'appointments.view': 'location',
    });
    await env.get('/patients', person).expect(403);
    await env.get('/patients', w.people.NoRoleU).expect(403);
  });
});
