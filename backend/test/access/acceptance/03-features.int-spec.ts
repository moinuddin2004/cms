import { AuditLog } from 'src/common/audit/entities/audit-log.entity';
import type { MeAccess } from 'src/access/access.controller';
import { bootApp, dataOf, Env, errorOf, seedWorld } from './harness';

interface OwnerFeature {
  key: string;
  entitled: boolean;
  enabled: boolean;
  active: boolean;
  lockedReason: string | null;
}
interface OwnerView {
  modules: { module: string; features: OwnerFeature[] }[];
}
interface CatalogRow {
  id: string;
  key: string;
  name: string;
  enabledByDefault: boolean;
}

/** Section 3 — Feature entitlement (AC-FEAT). FEAT-13 / FEAT-14 are UI cases (vitest). */
describe('AC-FEAT feature entitlement', () => {
  let env: Env;
  let w: Env['world'];
  const sa = () => w.people.SA;
  const saCall = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    body?: object,
  ) => env.call(method, url, sa(), { body, org: null, loc: null });

  const entitle = (key: string, entitled: boolean, until?: string) =>
    saCall('patch', `/feature-flags/org/${w.orgA}/${key}/entitlement`, {
      entitled,
      ...(until ? { until } : {}),
    });
  const me = async (who = w.people.RecU, loc = who.locId) =>
    dataOf<MeAccess>(await env.get('/me/access', who, { loc }).expect(200));
  const ownerView = async () =>
    dataOf<OwnerView>(await env.get('/admin/features', w.people.OwnerA).expect(200));
  const featureRow = async (key: string) =>
    (await ownerView()).modules
      .flatMap((m) => m.features)
      .find((f) => f.key === key)!;
  const auditCount = (entityType: string) =>
    env.ds
      .getRepository(AuditLog)
      .count({ where: { organizationId: w.orgA, entityType } });

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'feat');
  }, 900_000);
  afterAll(async () => env?.close());

  it('FEAT-01 active = entitled ∧ enabled (owners are filtered too)', async () => {
    await entitle('inventory.core', false).expect(200);
    try {
      const staff = await me(w.people.AsstU);
      expect(staff.features).not.toContain('inventory.core');
      expect(staff.permissions['inventory.view']).toBeUndefined();
      await env.get('/inventory/items', w.people.AsstU).expect(403);
      const owner = await me(w.people.OwnerA);
      expect(owner.features).not.toContain('inventory.core');
      expect(owner.permissions['inventory.view']).toBeUndefined();
      expect(owner.permissions['inventory.stock.adjust']).toBeUndefined();
      await env.get('/inventory/items', w.people.OwnerA).expect(403);
    } finally {
      await entitle('inventory.core', true).expect(200);
    }
    expect((await me(w.people.AsstU)).permissions['inventory.view']).toBe(true);
  });

  it('FEAT-02 owner cannot enable an unentitled feature → 403 NOT_ENTITLED', async () => {
    await entitle('inventory.core', false).expect(200);
    try {
      const res = await env
        .patch('/admin/features/inventory.core', w.people.OwnerA, {
          enabled: true,
        })
        .expect(403);
      expect(errorOf(res).code).toBe('NOT_ENTITLED');
    } finally {
      await entitle('inventory.core', true).expect(200);
    }
  });

  it('FEAT-03 owner toggles an entitled feature: version bump + audit each time', async () => {
    const toggle = async (enabled: boolean) => {
      const v = await env.version();
      const a = await auditCount('org_feature_flag');
      await env
        .patch('/admin/features/inventory.core', w.people.OwnerA, { enabled })
        .expect(200);
      expect(await env.version()).toBeGreaterThanOrEqual(v + 1);
      expect(await auditCount('org_feature_flag')).toBe(a + 1);
      expect((await me(w.people.AsstU)).features.includes('inventory.core')).toBe(
        enabled,
      );
    };
    await toggle(false);
    await toggle(true);
  });

  it('FEAT-04 SA entitlement endpoint: 200 and the owner page shows it locked', async () => {
    await entitle('inventory.core', false).expect(200);
    try {
      const row = await featureRow('inventory.core');
      expect(row.entitled).toBe(false);
      expect(row.active).toBe(false);
      expect(row.lockedReason).toBeTruthy();
    } finally {
      await entitle('inventory.core', true).expect(200);
    }
  });

  it('FEAT-05 non-SA cannot entitle → 403', async () => {
    await env
      .patch(
        `/feature-flags/org/${w.orgA}/inventory.core/entitlement`,
        w.people.OwnerA,
        { entitled: false },
      )
      .expect(403);
    expect((await featureRow('inventory.core')).entitled).toBe(true);
  });

  it('FEAT-06 trial expiry: an expired `until` means the feature is not active', async () => {
    // The API refuses a past `until` (400) so an expired trial can only come from time passing.
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await entitle('inventory.core', true, yesterday).expect(400);
    // Let a trial expire the way it really happens: write the past date directly.
    await env.ds.query(
      `UPDATE org_feature_flags SET entitled_until = $2 WHERE organization_id = $1 AND feature_key = 'inventory.core'`,
      [w.orgA, yesterday],
    );
    await env.bump();
    try {
      expect((await me(w.people.AsstU)).features).not.toContain('inventory.core');
      expect((await featureRow('inventory.core')).lockedReason).toBe(
        'trial_expired',
      );
    } finally {
      await entitle('inventory.core', true).expect(200);
    }
  });

  it('FEAT-07 location override narrows: lab permissions gone at L2 only', async () => {
    const at = (loc: string) => me(w.people.MultiU, loc);
    expect((await at(w.L2)).permissions['lab.orders.create']).toBeDefined();
    await env
      .put(`/admin/features/dental.lab_orders/locations/${w.L2}`, w.people.OwnerA, {
        disabled: true,
      })
      .expect(200);
    try {
      const l2 = await at(w.L2);
      expect(l2.permissions['lab.orders.create']).toBeUndefined();
      expect(l2.permissions['lab.orders.view']).toBeUndefined();
      const l1 = await at(w.L1);
      expect(l1.permissions['lab.orders.view']).toBeDefined();
    } finally {
      await env
        .put(`/admin/features/dental.lab_orders/locations/${w.L2}`, w.people.OwnerA, {
          disabled: false,
        })
        .expect(200);
    }
    expect((await at(w.L2)).permissions['lab.orders.create']).toBeDefined();
  });

  it('FEAT-08 location override cannot widen: org-off stays off at the location', async () => {
    await env
      .patch('/admin/features/dental.lab_orders', w.people.OwnerA, {
        enabled: false,
      })
      .expect(200);
    try {
      const res = await env.put(
        `/admin/features/dental.lab_orders/locations/${w.L2}`,
        w.people.OwnerA,
        { disabled: false },
      );
      // The API answers 200 as a no-op (it only ever records "disabled here");
      // the invariant is that nothing got widened.
      expect([200, 400, 403, 409]).toContain(res.status);
      const l2 = await me(w.people.MultiU, w.L2);
      expect(l2.features).not.toContain('dental.lab_orders');
      expect(l2.permissions['lab.orders.create']).toBeUndefined();
    } finally {
      await env
        .patch('/admin/features/dental.lab_orders', w.people.OwnerA, {
          enabled: true,
        })
        .expect(200);
    }
  });

  it('FEAT-09 impact list', async () => {
    const res = await env
      .get('/admin/features/billing.discounts/impact', w.people.OwnerA)
      .expect(200);
    const impact = dataOf<{
      permissions: { key: string }[];
      roles: { name: string; permissions: string[] }[];
    }>(res);
    const keys = impact.permissions.map((p) => p.key);
    expect(keys).toEqual(
      expect.arrayContaining(['billing.discount.apply', 'billing.discount.custom']),
    );
    const names = impact.roles.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['Receptionist', 'Admin']));
    const rec = impact.roles.find((r) => r.name === 'Receptionist')!;
    expect(rec.permissions).toContain('billing.discount.apply');
  });

  it('FEAT-10 missing row default: entitled + enabled when enabledByDefault', async () => {
    const catalog = dataOf<CatalogRow[]>(await saCall('get', '/feature-flags/catalog').expect(200));
    const byDefault = catalog.find((c) => c.key === 'patients.core');
    expect(byDefault?.enabledByDefault).toBe(true);
    await env.ds.query(
      `DELETE FROM org_feature_flags WHERE organization_id = $1 AND feature_key = 'patients.core'`,
      [w.orgA],
    );
    await env.bump();
    expect((await me(w.people.RecU)).features).toContain('patients.core');
    const row = await featureRow('patients.core');
    expect(row.entitled).toBe(true);
    expect(row.enabled).toBe(true);
  });

  it('FEAT-11 catalog reseed keeps SA edits (only missing keys are inserted)', async () => {
    const catalog = dataOf<CatalogRow[]>(await saCall('get', '/feature-flags/catalog').expect(200));
    const item = catalog.find((c) => c.key === 'inventory.core')!;
    const original = item.name;
    await saCall('patch', `/feature-flags/catalog/${item.id}`, {
      name: 'SA renamed inventory',
    }).expect(200);
    let second: Env | undefined;
    try {
      // "Restart the app module": a second application boots against the same schema.
      second = await bootApp();
      const again = dataOf<CatalogRow[]>(
        await second
          .call('get', '/feature-flags/catalog', sa(), { org: null, loc: null })
          .expect(200),
      );
      expect(again.find((c) => c.key === 'inventory.core')!.name).toBe(
        'SA renamed inventory',
      );
    } finally {
      await second?.close();
      await saCall('patch', `/feature-flags/catalog/${item.id}`, {
        name: original,
      }).expect(200);
    }
  });

  it('FEAT-12 my-features membership: no cross-org leak', async () => {
    await env
      .get('/feature-flags/my-features', w.people.RecU, { org: w.orgB, loc: w.LB1 })
      .expect(403);
    await env.get('/feature-flags/my-features', w.people.RecU).expect(200);
  });
});
