import { addStaff, bootApp, dataOf, Env, seedWorld } from './harness';
import {
  expandImplies,
  filterByFeatures,
  normalizeGrants,
  PERMISSION_KEYS,
  PERMISSIONS,
} from 'src/access/catalog/permissions';
import { ROLE_TEMPLATES } from 'src/access/catalog/templates';
import type { MeAccess } from 'src/access/access.controller';

/** Section 1 — Resolution & /me/access (AC-RES). */
describe('AC-RES resolution', () => {
  let env: Env;
  let w: Env['world'];

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'res');
  }, 900_000);
  afterAll(async () => env?.close());

  const me = async (
    who: Parameters<Env['get']>[1],
    o: Parameters<Env['get']>[2] = {},
  ) => dataOf<MeAccess>(await env.get('/me/access', who, o).expect(200));

  const template = (key: string) =>
    expandImplies(
      normalizeGrants(ROLE_TEMPLATES.find((t) => t.key === key)!.permissions),
    );

  it('RES-01 owner gets everything', async () => {
    const m = await me(w.people.OwnerA);
    expect(m.isOwner).toBe(true);
    for (const k of PERMISSION_KEYS) {
      const scopes = PERMISSIONS[k].scopes;
      expect(m.permissions[k]).toBe(scopes?.length ? 'org' : true);
    }
    const active = [
      ...(await env.flags.getEnabledFeatures(w.orgA, w.L1)),
    ].sort();
    expect([...m.features].sort()).toEqual(active);
  });

  it('RES-02 super admin gets everything in any org', async () => {
    for (const [org, loc] of [
      [w.orgA, w.L1],
      [w.orgB, w.LB1],
    ]) {
      const m = await me(w.people.SA, { org, loc });
      expect(m.isSuperAdmin).toBe(true);
      for (const k of PERMISSION_KEYS) expect(m.permissions[k]).toBeDefined();
    }
  });

  it('RES-03 doctor template', async () => {
    const m = await me(w.people.Doc1);
    expect(m.permissions).toEqual(
      filterByFeatures(template('doctor'), new Set(m.features)),
    );
    expect(m.permissions['patients.view']).toBe('own');
    expect(m.permissions['consultation.conduct']).toBe('own');
    expect(Object.keys(m.permissions).some((k) => k.startsWith('billing.'))).toBe(
      false,
    );
    expect(m.homeRoute).toBe('/queue/doctor');
    expect(m.employeeId).toBe(w.people.Doc1.employeeId);
  });

  it('RES-04 fail-closed: no role', async () => {
    expect((await me(w.people.NoRoleU)).permissions).toEqual({});
  });

  it('RES-05 fail-closed: legacy-only role', async () => {
    expect((await me(w.people.LegacyU)).permissions).toEqual({});
  });

  it('RES-06 no portal access', async () => {
    const res = await env.get('/me/access', w.people.NoPortalU);
    if (res.status === 200) {
      expect(dataOf<MeAccess>(res).permissions).toEqual({});
    } else {
      expect(res.status).toBe(403);
    }
    await env.get('/patients', w.people.NoPortalU).expect(403);
  });

  it('RES-07 implies expands', async () => {
    const { person } = await addStaff(env, 'Voider', {
      'billing.invoice.void': true,
    });
    const m = await me(person);
    expect(m.permissions['billing.invoice.void']).toBe(true);
    expect(m.permissions['billing.invoice.view']).toBeDefined();
  });

  it('RES-08 feature filter', async () => {
    await env.flags.toggleFeature(w.orgA, 'billing.discounts', false);
    try {
      const m = await me(w.people.RecU);
      expect(m.permissions['billing.discount.apply']).toBeUndefined();
      expect(m.permissions['billing.desk.use']).toBe(true);
    } finally {
      await env.flags.toggleFeature(w.orgA, 'billing.discounts', true);
    }
  });

  it('RES-09 location-specific role', async () => {
    const l1 = await me(w.people.MultiU, { loc: w.L1 });
    const l2 = await me(w.people.MultiU, { loc: w.L2 });
    expect(l1.permissions).toEqual(
      filterByFeatures(template('receptionist'), new Set(l1.features)),
    );
    expect(l2.permissions).toEqual(
      filterByFeatures(template('doctor'), new Set(l2.features)),
    );
    expect(l1.permissions['billing.desk.use']).toBe(true);
    expect(l1.permissions['consultation.conduct']).toBeUndefined();
    expect(l2.permissions['consultation.conduct']).toBe('own');
    expect(l2.permissions['billing.desk.use']).toBeUndefined();
  });

  it('RES-10 missing org header → 400', async () => {
    await env.get('/me/access', w.people.RecU, { org: null }).expect(400);
  });

  it('RES-11 foreign org → 403', async () => {
    await env
      .get('/me/access', w.people.RecU, { org: w.orgB, loc: w.LB1 })
      .expect(403);
  });

  it('RES-12 nav and homeRoute', async () => {
    expect((await me(w.people.RecU)).nav).toBeNull();
    const layout = {
      sections: [{ items: [{ key: 'nav.dashboard' }] }],
      hidden: ['nav.payroll'],
    };
    await env.put('/admin/navigation', w.people.OwnerA, layout).expect(200);
    try {
      expect((await me(w.people.RecU)).nav).toEqual(layout);
    } finally {
      await env.del('/admin/navigation', w.people.OwnerA).expect(200);
    }
    expect((await me(w.people.RecU)).nav).toBeNull();
  });

  it('RES-13 version number', async () => {
    const before = (await me(w.people.RecU)).version;
    const { roleId } = await addStaff(env, 'VerBump', {});
    await env.ds.query(
      `UPDATE employment_roles SET permissions = '{"patients.view":"org"}' WHERE id = $1`,
      [roleId],
    );
    await env.bump();
    const after = (await me(w.people.RecU)).version;
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });
});
