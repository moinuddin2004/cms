import { randomUUID } from 'crypto';
import type * as request from 'supertest';
import {
  addStaff,
  bearer,
  bootApp,
  dataOf,
  Env,
  errorOf,
  note,
  Person,
  seedWorld,
} from './harness';
import { LabSeed, seedLab } from './lab-fixture';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Section 6 — Module permission checks (AC-MOD). */
describe('AC-MOD module permissions', () => {
  let env: Env;
  let w: Env['world'];
  let lab: LabSeed;
  let appointmentId: string;
  let encounterIds: { doc1: string; doc2: string };
  let serviceId: string;
  let discountTypeId: string;
  const uuid = () => randomUUID();

  /**
   * One allowed + one denied actor on the same call. Denied must be 403
   * NO_PERMISSION with `key` in `missing`; allowed must get past the guard
   * (the handler runs: 2xx, or a validation / not-found answer for the
   * placeholder ids used here — the status is recorded in the notes).
   */
  async function gate(
    id: string,
    key: string,
    call: (who: Person) => request.Test,
    allowed: Person,
    denied: Person,
    opts: { expectAllowed?: (s: number) => boolean } = {},
  ) {
    const d = await call(denied);
    expect({ id, status: d.status }).toEqual({ id, status: 403 });
    const err = errorOf(d);
    expect(err.code).toBe('NO_PERMISSION');
    expect(err.missing).toContain(key);
    const a = await call(allowed);
    expect([401, 403]).not.toContain(a.status);
    if (opts.expectAllowed) expect(opts.expectAllowed(a.status)).toBe(true);
    note(id, `allowed → ${a.status}, denied → 403 NO_PERMISSION(${key})`);
    return a;
  }
  const c =
    (method: Method, url: string, body?: object, o = {}) =>
    (who: Person) =>
      env.call(method, url, who, { body, ...o });
  const ok2xx = (s: number) => s >= 200 && s < 300;

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'mod');
    const [appt] = await env.ds.query<{ id: string }[]>(
      'SELECT id FROM appointments WHERE patient_id = $1',
      [w.patients.P1],
    );
    appointmentId = appt.id;
    const enc = await env.ds.query<{ id: string; queue_entry_id: string }[]>(
      'SELECT id, queue_entry_id FROM patient_encounters WHERE organization_id = $1',
      [w.orgA],
    );
    encounterIds = {
      doc1: enc.find((e) => e.queue_entry_id === w.encounters.doc1)!.id,
      doc2: enc.find((e) => e.queue_entry_id === w.encounters.doc2)!.id,
    };
    lab = await seedLab(env);

    // Billing: a catalog service and a preset discount type (value 10%, editable 5–15%).
    const owner = w.people.OwnerA;
    serviceId = dataOf<{ id: string }>(
      await env
        .post('/billing/services', owner, {
          name: 'Scaling',
          kind: 'PROCEDURE',
          defaultPrice: 1000,
        })
        .expect(201),
    ).id;
    discountTypeId = dataOf<{ id: string }>(
      await env
        .post('/billing/discount-types', owner, {
          name: 'Staff discount',
          kind: 'PERCENTAGE',
          value: 10,
          receptionEditable: true,
          minValue: 5,
          maxValue: 15,
        })
        .expect(201),
    ).id;
  }, 900_000);
  afterAll(async () => env?.close());

  const newCharge = async (who: Person) =>
    dataOf<{ id: string }>(
      await env
        .post(`/patients/${w.patients.P1}/charges`, who, { serviceId })
        .expect(201),
    ).id;

  // ── Billing ───────────────────────────────────────────────────────────────

  it('MOD-01 billing desk collect payment', async () => {
    const p = w.people;
    await gate('MOD-01', 'billing.payment.collect', c('post', '/payments', {}), p.RecU, p.AsstU);
  });

  it('MOD-02 invoice void', async () => {
    const p = w.people;
    await gate('MOD-02', 'billing.invoice.void', c('post', `/invoices/${uuid()}/cancel`, {}), p.AcctU, p.RecU);
  });

  it('MOD-03 refund', async () => {
    const p = w.people;
    await gate('MOD-03', 'billing.refund.issue', c('post', '/refunds', {}), p.AcctU, p.RecU);
  });

  it('MOD-04 price override: edit a catalog charge price', async () => {
    const adminCharge = await newCharge(w.people.AdminU);
    await env
      .patch(`/charges/${adminCharge}`, w.people.AdminU, { unitPrice: 800 })
      .expect(200);
    const recCharge = await newCharge(w.people.RecU);
    const denied = await env.patch(`/charges/${recCharge}`, w.people.RecU, {
      unitPrice: 800,
    });
    expect(denied.status).toBe(403);
    const code = errorOf(denied).code;
    // Domain error of the billing policy (D5), not the generic NO_PERMISSION body.
    note('MOD-04', `AdminU 200; RecU 403 ${String(code)}`);
    expect(['NO_PERMISSION', 'BILLING_PRICE_CHANGE_NOT_ALLOWED']).toContain(code);
  });

  it('MOD-05 preset discount in range', async () => {
    const rec = await newCharge(w.people.RecU);
    await env
      .post(`/charges/${rec}/discount`, w.people.RecU, {
        discountTypeId,
        value: 10,
      })
      .expect(201);
    const denied = await env.post(`/charges/${rec}/discount`, w.people.AsstU, {
      discountTypeId,
      value: 10,
    });
    expect(denied.status).toBe(403);
    expect(errorOf(denied).code).toBe('NO_PERMISSION');
    expect(errorOf(denied).missing).toContain('billing.discount.apply');
  });

  it('MOD-06 discount out of range needs billing.discount.custom', async () => {
    const adminCharge = await newCharge(w.people.AdminU);
    const allowed = await env.post(`/charges/${adminCharge}/discount`, w.people.AdminU, {
      discountTypeId,
      value: 40,
    });
    expect(ok2xx(allowed.status)).toBe(true);
    const recCharge = await newCharge(w.people.RecU);
    const denied = await env.post(`/charges/${recCharge}/discount`, w.people.RecU, {
      discountTypeId,
      value: 40,
    });
    expect(denied.status).toBe(403);
    const code = errorOf(denied).code;
    note('MOD-06', `AdminU ${allowed.status}; RecU 403 ${String(code)}`);
    expect([
      'NO_PERMISSION',
      'BILLING_DISCOUNT_VALUE_NOT_ALLOWED',
      'BILLING_DISCOUNT_NEEDS_APPROVAL',
    ]).toContain(code);
  });

  it('MOD-07 cash close', async () => {
    const p = w.people;
    await gate('MOD-07', 'billing.cash_close', c('get', '/billing/cash-close/preview'), p.AcctU, p.RecU);
  });

  it('MOD-08 expenses write', async () => {
    const p = w.people;
    await gate('MOD-08', 'expenses.manage', c('post', '/expenses', {}), p.AcctU, p.RecU);
  });

  // ── Commissions ───────────────────────────────────────────────────────────

  it('MOD-09 own earnings', async () => {
    const p = w.people;
    await gate('MOD-09', 'earnings.own.view', c('get', '/me/earnings'), p.Doc1, p.RecU);
  });

  it('MOD-10 all doctor earnings', async () => {
    const p = w.people;
    await gate('MOD-10', 'earnings.all.view', c('get', '/reports/doctor-earnings'), p.AcctU, p.Doc1);
  });

  it('MOD-11 compensation plans', async () => {
    const p = w.people;
    await gate(
      'MOD-11',
      'compensation.manage',
      c('get', `/assignments/${p.Doc1.assignmentId}/compensation-plans`),
      p.AdminU,
      p.AcctU,
    );
  });

  // ── Appointments & queue ──────────────────────────────────────────────────

  it('MOD-12 book appointment', async () => {
    const p = w.people;
    await gate('MOD-12', 'appointments.book', c('post', '/appointments/validate', {}), p.RecU, p.Doc1);
  });

  it('MOD-13 cancel appointment', async () => {
    const p = w.people;
    await gate('MOD-13', 'appointments.cancel', c('patch', `/appointments/${appointmentId}/cancel`, {}), p.RecU, p.AsstU);
  });

  it('MOD-14 check-in', async () => {
    const p = w.people;
    await gate('MOD-14', 'queue.checkin', c('post', '/queue/walk-ins', {}), p.RecU, p.Doc1);
  });

  it('MOD-15 queue skip/remove (entry manage)', async () => {
    const p = w.people;
    await gate('MOD-15', 'queue.entry.manage', c('patch', `/queue/entries/${uuid()}/cancel`, {}), p.RecU, p.AsstU);
  });

  it('MOD-16 reprioritize', async () => {
    const p = w.people;
    await gate('MOD-16', 'queue.entry.reprioritize', c('patch', `/queue/entries/${uuid()}/priority`, {}), p.AdminU, p.RecU);
  });

  it('MOD-17 own doctor queue', async () => {
    const p = w.people;
    await gate('MOD-17', 'queue.doctor.own', c('get', '/queue/my-session'), p.Doc1, p.RecU);
  });

  it("MOD-18 other doctor's queue (queue.doctor.any): AdminU allowed, Doc1 denied", async () => {
    const p = w.people;
    const call = c('patch', `/queue/entries/${uuid()}/force-complete`, {});
    const doc1 = await call(p.Doc1);
    expect(doc1.status).toBe(403);
    expect(errorOf(doc1).missing).toContain('queue.doctor.any');
    const admin = await call(p.AdminU);
    note('MOD-18', `AdminU → ${admin.status} ${JSON.stringify(errorOf(admin).missing ?? '')}`);
    // The plan expects the Admin to run any doctor's queue.
    expect([401, 403]).not.toContain(admin.status);
  });

  it('MOD-19 consultation own: Doc1 on own encounter ok, Doc2 refused', async () => {
    const p = w.people;
    const mine = await env.get(`/encounters/${encounterIds.doc1}/workspace`, p.Doc1);
    expect(mine.status).toBe(200);
    const other = await env.get(`/encounters/${encounterIds.doc1}/workspace`, p.Doc2);
    expect([403, 404]).toContain(other.status);
    const patch = await env.patch(`/encounters/${encounterIds.doc1}`, p.Doc2, {
      diagnosis: 'hijack',
    });
    expect([403, 404]).toContain(patch.status);
    note('MOD-19', `Doc1 200; Doc2 workspace ${other.status}, patch ${patch.status} (scope reads as not found)`);
  });

  // ── Patients & clinical ───────────────────────────────────────────────────

  it('MOD-20 clinical note edit', async () => {
    const p = w.people;
    await gate('MOD-20', 'patients.clinical.edit', c('post', `/patients/${w.patients.P1}/vitals`, {}), p.Doc1, p.RecU);
  });

  it('MOD-21 patient delete', async () => {
    const p = w.people;
    const mk = async () =>
      dataOf<{ id: string }>(
        await env
          .post('/patients', p.RecU, { fullName: 'To Delete', phone: `0300${Math.floor(1e6 + Math.random() * 9e6)}` })
          .expect(201),
      ).id;
    const id = await mk();
    const denied = await env.del(`/patients/${id}`, p.RecU);
    expect(denied.status).toBe(403);
    expect(errorOf(denied).missing).toContain('patients.delete');
    const allowed = await env.del(`/patients/${id}`, p.AdminU);
    expect(ok2xx(allowed.status)).toBe(true);
  });

  it('MOD-22 patient export (patients.export)', async () => {
    const p = w.people;
    // Denied: Receptionist has no patients.export.
    const denied = await env.get('/patients/export', p.RecU);
    expect(denied.status).toBe(403);
    expect(errorOf(denied).missing).toContain('patients.export');

    // Allowed: Admin (org scope) gets a CSV with every OrgA patient.
    const res = await env.get('/patients/export', p.AdminU);
    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'])).toContain('text/csv');
    expect(String(res.headers['content-disposition'])).toMatch(/patients-.*\.csv/);
    const csv = res.text.replace(/^﻿/, '');
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Patient number');
    expect(csv).toContain('Patient One');
    expect(csv).toContain('Patient Three');

    // The export follows patients.view scope: an `own` role with export rights
    // but no patients of its own gets the header only.
    const { person: ownExporter } = await addStaff(env, 'Exporter', {
      'patients.view': 'own',
      'patients.export': true,
    });
    const own = await env.get('/patients/export', ownExporter);
    expect(own.status).toBe(200);
    expect(own.text.replace(/^﻿/, '').split('\r\n')).toHaveLength(1);

    // Every export is audited.
    const audit = await env.ds.query<{ n: string }[]>(
      `SELECT count(*)::int AS n FROM audit_logs
        WHERE organization_id = $1 AND entity_type = 'patient_export' AND action = 'export'`,
      [w.orgA],
    );
    expect(Number(audit[0].n)).toBeGreaterThanOrEqual(2);
    note('MOD-22', `AdminU → 200 CSV (${lines.length - 1} rows), own-scope exporter → header only, RecU → 403, audit rows ${audit[0].n}`);
  });

  it('MOD-23 prescription create', async () => {
    const p = w.people;
    await gate('MOD-23', 'prescriptions.create', c('post', '/prescriptions', {}), p.Doc1, p.RecU);
  });

  // ── Inventory ─────────────────────────────────────────────────────────────

  it('MOD-24 inventory stock adjust', async () => {
    const p = w.people;
    await gate('MOD-24', 'inventory.stock.adjust', c('post', `/inventory/items/${uuid()}/adjust-stock`, {}), p.AdminU, p.AsstU);
  });

  it('MOD-25 inventory view', async () => {
    const p = w.people;
    await gate('MOD-25', 'inventory.view', c('get', '/inventory/items'), p.AsstU, p.RecU, { expectAllowed: ok2xx });
  });

  // ── Lab ───────────────────────────────────────────────────────────────────

  it('MOD-26 lab order create', async () => {
    const p = w.people;
    const body = {
      patientId: w.patients.P1,
      labId: lab.labId,
      items: [{ labServiceId: lab.serviceId, answers: { material: 'emax' } }],
    };
    await gate('MOD-26', 'lab.orders.create', c('post', '/lab-orders', body), p.Doc1, p.RecU, { expectAllowed: ok2xx });
  });

  it('MOD-27 lab billing', async () => {
    const p = w.people;
    await gate('MOD-27', 'lab.billing.manage', c('get', '/lab-billing/invoices'), p.AcctU, p.Doc1, { expectAllowed: ok2xx });
  });

  it('MOD-28 lab catalog (clinic price list write)', async () => {
    const p = w.people;
    await gate('MOD-28', 'lab.catalog.manage', c('post', '/lab-catalog/mappings', {}), p.AdminU, p.AcctU);
  });

  it('MOD-29 lab payables', async () => {
    const p = w.people;
    await gate('MOD-29', 'lab.payables.manage', c('get', '/lab-payables/bills'), p.AcctU, p.RecU, { expectAllowed: ok2xx });
  });

  it('MOD-30 lab template share', async () => {
    const p = w.people;
    const body = {
      name: 'Shared crown',
      shared: true,
      items: [
        {
          labServiceId: lab.serviceId,
          answers: {
            teeth: [{ tooth: '11' }],
            material: 'zirconia_monolithic',
            shade_system: 'VITA_classical',
            shade: 'A2',
            impression_type: 'physical',
          },
        },
      ],
    };
    const denied = await env.post('/lab-catalog/order-templates', p.Doc1, body);
    expect(denied.status).toBe(403);
    const code = errorOf(denied).code;
    note('MOD-30', `Doc1 403 ${String(code)} (service-level check for shared templates)`);
    const allowed = await env.post('/lab-catalog/order-templates', p.AdminU, body);
    expect(ok2xx(allowed.status)).toBe(true);
    expect(['NO_PERMISSION', 'ORDER_TEMPLATE_FORBIDDEN']).toContain(code);
  });

  // ── Team ──────────────────────────────────────────────────────────────────

  it('MOD-31 employees write', async () => {
    const p = w.people;
    await gate('MOD-31', 'employees.manage', c('post', '/employees', {}), p.AdminU, p.AcctU);
  });

  it('MOD-32 payroll list', async () => {
    const p = w.people;
    await gate('MOD-32', 'payroll.manage', c('get', '/payroll/location?month=1&year=2026'), p.AdminU, p.AcctU);
  });

  it('MOD-33 leave approve', async () => {
    const p = w.people;
    await gate('MOD-33', 'leave.approve', c('patch', `/leaves/${uuid()}/approve`, {}), p.AdminU, p.RecU);
  });

  // ── Reports & admin ───────────────────────────────────────────────────────

  it('MOD-34 report export', async () => {
    const p = w.people;
    await gate('MOD-34', 'reports.export', c('get', '/reports/profit-loss/export?format=xlsx'), p.AcctU, p.Doc1, { expectAllowed: ok2xx });
  });

  it('MOD-35 finance overview', async () => {
    const p = w.people;
    await gate('MOD-35', 'finance.overview.view', c('get', '/reports/finance/overview'), p.AcctU, p.RecU, { expectAllowed: ok2xx });
  });

  it('MOD-36 notification settings', async () => {
    const p = w.people;
    await gate('MOD-36', 'notifications.settings.manage', c('put', '/notification-settings/rules', {}), p.AdminU, p.RecU);
  });

  it('MOD-37 locations admin (no tenant headers)', async () => {
    const p = w.people;
    const call = (who: Person) =>
      env.call('patch', `/locations/${w.L1}/settings`, who, {
        body: {},
        org: null,
        loc: null,
      });
    const denied = await call(p.RecU);
    expect(denied.status).toBe(403);
    expect(errorOf(denied).missing).toContain('admin.locations.manage');
    const allowed = await call(p.AdminU);
    expect(ok2xx(allowed.status)).toBe(true);
    note('MOD-37', `AdminU ${allowed.status}`);
  });

  it('MOD-38 users admin (create a staff login)', async () => {
    const p = w.people;
    // An employee of OrgA at L1 with no login yet.
    const [employee] = await env.ds.query<{ id: string }[]>(
      `INSERT INTO employees (full_name, phone) VALUES ($1, $2) RETURNING id`,
      [`No Login ${uuid().slice(0, 6)}`, `0399${Date.now().toString().slice(-7)}`],
    );
    await env.ds.query(
      `INSERT INTO employee_org_location_assignments
         (employee_id, organization_id, location_id, designation, employee_code,
          joining_date, has_portal_access, created_by)
       VALUES ($1, $2, $3, 'Nurse', $4, '2024-01-01', false, $5)`,
      [employee.id, w.orgA, w.L1, `NL${Date.now() % 100000}`, p.AdminU.userId],
    );
    const auth = (who: Person) => ({ headers: { Authorization: bearer(who) } });
    const staffBody = () => ({
      email: `staff.${uuid().slice(0, 8)}@acceptance-it.test`,
      name: 'Staff Login',
      password: 'Acceptance#12345',
      type: 'employee',
      employeeId: employee.id,
    });

    // RecU: no admin.users.manage.
    const denied = await env.call('post', '/user', p.RecU, { body: staffBody(), ...auth(p.RecU) });
    expect(denied.status).toBe(403);
    expect(errorOf(denied).missing).toContain('admin.users.manage');

    // The employee is offered as a candidate, then the Admin creates the login.
    const candidates = await env.call('get', '/user/staff-candidates', p.AdminU, auth(p.AdminU));
    expect(candidates.status).toBe(200);
    expect((candidates.body as { employeeId: string }[]).map((c) => c.employeeId)).toContain(employee.id);
    const allowed = await env.call('post', '/user', p.AdminU, { body: staffBody(), ...auth(p.AdminU) });
    expect(ok2xx(allowed.status)).toBe(true);
    const [assignment] = await env.ds.query<{ user_id: string; has_portal_access: boolean }[]>(
      `SELECT user_id, has_portal_access FROM employee_org_location_assignments WHERE employee_id = $1`,
      [employee.id],
    );
    expect(assignment.user_id).toBe((allowed.body as { uuid: string }).uuid);
    expect(assignment.has_portal_access).toBe(true);

    // A second login for the same employee is refused; an Admin (not owner) still cannot add owners.
    const again = await env.call('post', '/user', p.AdminU, { body: staffBody(), ...auth(p.AdminU) });
    expect(again.status).toBe(409);
    const owner = await env.call('post', '/user', p.AdminU, {
      body: { ...staffBody(), type: 'owner', employeeId: undefined },
      ...auth(p.AdminU),
    });
    expect(owner.status).toBe(403);
    note('MOD-38', `RecU → 403, AdminU staff login → ${allowed.status} (linked, portal on), repeat → 409, owner by Admin → 403`);
  });

  it('MOD-39 owner account protection', async () => {
    const p = w.people;
    const call = (who: Person) =>
      env.call('patch', `/user/${p.OwnerA.userId}`, who, {
        body: { name: 'Renamed owner' },
        headers: { Authorization: bearer(who) },
      });
    const admin = await call(p.AdminU);
    expect(admin.status).toBe(403);
    const owner = await call(p.OwnerA);
    note('MOD-39', `AdminU ${admin.status}; OwnerA ${owner.status}`);
    expect(ok2xx(owner.status)).toBe(true);
  });

  it('MOD-40 theme admin', async () => {
    const p = w.people;
    const body = { values: { app_name: 'Acceptance Clinic' } };
    await gate('MOD-40', 'admin.theme.manage', c('put', '/admin/theme', body), p.AdminU, p.RecU, { expectAllowed: ok2xx });
    await env.put('/admin/theme', p.OwnerA, body).expect(200);
  });

  it('MOD-41 lab portal untouched: only lab membership counts, clinic roles are irrelevant', async () => {
    const p = w.people;
    const portal = (who: Person) =>
      env.call('get', '/lab-portal/orders', who, { org: null, loc: null });
    const asLab = await portal(lab.labAdmin);
    expect([200]).toContain(asLab.status);
    // A clinic Admin / Owner / Super admin without a lab membership is refused by LabPortalGuard.
    for (const who of [p.AdminU, p.OwnerA]) {
      const res = await portal(who);
      expect([401, 403]).toContain(res.status);
    }
    note('MOD-41', `lab_admin 200; clinic AdminU/OwnerA refused by LabPortalGuard`);
  });
});
