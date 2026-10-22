import { ForbiddenException } from '@nestjs/common';
import { featureState, resolveEnabledFeatures } from './feature-state';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureAdminService } from './feature-admin.service';
import { OrgFeatureFlag } from './entities/org-feature-flag.entity';
import { LocationFeatureOverride } from './entities/location-feature-override.entity';
import { AccessResolver } from 'src/access/access.resolver';
import { AuditAction, ActorSide } from 'src/common/audit/audit.enums';

const ORG = '11111111-1111-1111-1111-111111111111';
const LOC = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-10-22T10:00:00Z');
const LATER = new Date('2026-11-01T00:00:00Z');
const EARLIER = new Date('2026-10-01T00:00:00Z');

const item = (key: string, enabledByDefault = false, module = 'm') => ({
  id: `cat-${key}`,
  key,
  name: key,
  module,
  description: null,
  specialtyTags: ['general'],
  enabledByDefault,
  isActive: true,
  sortOrder: 0,
});

describe('featureState: active = entitled ∧ enabled', () => {
  const on = item('a', true);
  const off = item('b', false);

  it('missing row → entitled, enabled per catalog default', () => {
    expect(featureState(on, undefined, NOW)).toMatchObject({
      entitled: true,
      enabled: true,
      active: true,
      lockedReason: null,
    });
    expect(featureState(off, undefined, NOW)).toMatchObject({
      entitled: true,
      enabled: false,
      active: false,
    });
  });

  it('enabled but not entitled is not active and locked', () => {
    const s = featureState(
      on,
      { featureKey: 'a', isEnabled: true, isEntitled: false },
      NOW,
    );
    expect(s).toMatchObject({
      entitled: false,
      enabled: true,
      active: false,
      lockedReason: 'not_entitled',
    });
  });

  it('entitled but switched off by the owner is not active', () => {
    expect(
      featureState(
        on,
        { featureKey: 'a', isEnabled: false, isEntitled: true },
        NOW,
      ).active,
    ).toBe(false);
  });

  it('resolveEnabledFeatures applies the same rule', () => {
    const keys = resolveEnabledFeatures(
      [
        { featureKey: 'a', isEnabled: true, isEntitled: false },
        { featureKey: 'b', isEnabled: true, isEntitled: true },
        { featureKey: 'ghost', isEnabled: true, isEntitled: true },
      ],
      [on, off, item('c', true)],
      NOW,
    );
    expect([...keys].sort()).toEqual(['b', 'c']);
  });
});

describe('trial expiry', () => {
  const f = item('t', false);
  const row = (until: Date) => ({
    featureKey: 't',
    isEnabled: true,
    isEntitled: true,
    entitledUntil: until,
  });

  it('is entitled until the expiry', () => {
    expect(featureState(f, row(LATER), NOW)).toMatchObject({
      active: true,
      entitledUntil: LATER,
    });
  });

  it('is not entitled once the expiry has passed', () => {
    expect(featureState(f, row(EARLIER), NOW)).toMatchObject({
      entitled: false,
      active: false,
      lockedReason: 'trial_expired',
    });
    expect(resolveEnabledFeatures([row(EARLIER)], [f], NOW).size).toBe(0);
  });
});

// ── In-memory repos for the services ─────────────────────────────────

function makeWorld(opts: {
  catalog: ReturnType<typeof item>[];
  flags?: Partial<OrgFeatureFlag>[];
  overrides?: Partial<LocationFeatureOverride>[];
  roles?: { id: string; name: string; permissions: Record<string, unknown> }[];
}) {
  let seq = 0;
  const flags = (opts.flags ?? []).map((f) => ({
    id: `flag-${++seq}`,
    organizationId: ORG,
    isEntitled: true,
    entitledUntil: null,
    ...f,
  })) as OrgFeatureFlag[];
  const overrides = (opts.overrides ?? []).map((o) => ({
    id: `ovr-${++seq}`,
    organizationId: ORG,
    ...o,
  })) as LocationFeatureOverride[];

  const matches = (row: object, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => {
      const value = (row as Record<string, unknown>)[k];
      if (v && typeof v === 'object' && '_value' in v) {
        return (v as { _value: unknown[] })._value.includes(value);
      }
      return value === v;
    });

  const repoOf = <T extends { id: string }>(rows: T[], prefix: string) => ({
    find: jest.fn((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(rows.filter((r) => matches(r, args?.where))),
    ),
    findOne: jest.fn((args: { where: Record<string, unknown> }) =>
      Promise.resolve(rows.find((r) => matches(r, args.where)) ?? null),
    ),
    create: jest.fn((v: Partial<T>) => ({ ...v }) as T),
    save: jest.fn((row: T) => {
      if (!row.id) {
        row.id = `${prefix}-${++seq}`;
        rows.push(row);
      }
      return Promise.resolve(row);
    }),
  });

  const flagRepo = repoOf(flags, 'flag');
  const overrideRepo = repoOf(overrides, 'ovr');
  const manager = {
    transaction: jest.fn((cb: (m: unknown) => unknown) =>
      Promise.resolve(cb(manager)),
    ),
    getRepository: (target: unknown) =>
      target === OrgFeatureFlag ? flagRepo : overrideRepo,
  };
  Object.assign(flagRepo, { manager });
  Object.assign(overrideRepo, { manager });

  const catalogRepo = {
    find: jest.fn((args?: { where?: Record<string, unknown> }) =>
      Promise.resolve(opts.catalog.filter((c) => matches(c, args?.where))),
    ),
    findOne: jest.fn((args: { where: Record<string, unknown> }) =>
      Promise.resolve(opts.catalog.find((c) => matches(c, args.where)) ?? null),
    ),
  };
  const locationRepo = {
    findOne: jest.fn(
      (args: { where: { id: string; organizationId: string } }) =>
        Promise.resolve(
          args.where.id === LOC && args.where.organizationId === ORG
            ? { id: LOC }
            : null,
        ),
    ),
    find: jest.fn(() => Promise.resolve([{ id: LOC, name: 'Main' }])),
  };
  const roleRepo = {
    find: jest.fn(() => Promise.resolve(opts.roles ?? [])),
  };
  const audit = { record: jest.fn(() => Promise.resolve(true)) };
  const versions = { bumpQuietly: jest.fn(() => Promise.resolve()) };

  const flagsSvc = new FeatureFlagsService(
    catalogRepo as never,
    flagRepo as never,
    overrideRepo as never,
    { info: jest.fn() } as never,
  );
  const admin = new FeatureAdminService(
    catalogRepo as never,
    flagRepo as never,
    overrideRepo as never,
    locationRepo as never,
    roleRepo as never,
    flagsSvc,
    audit as never,
    versions as never,
  );
  return { flagsSvc, admin, flags, overrides, audit, versions, overrideRepo };
}

const owner = { userId: 'owner-1', side: ActorSide.CLINIC };
const platform = { userId: 'sa-1', side: ActorSide.PLATFORM };

describe('location override narrows only', () => {
  const catalog = [item('a', true), item('b', true), item('c', false)];

  it('removes features disabled at the location, never adds', async () => {
    const { flagsSvc } = makeWorld({
      catalog,
      overrides: [
        { locationId: LOC, featureKey: 'a', isDisabled: true },
        // org has c off: a "not disabled" row must not switch it on
        { locationId: LOC, featureKey: 'c', isDisabled: false },
      ],
    });
    expect([...(await flagsSvc.getEnabledFeatures(ORG))].sort()).toEqual([
      'a',
      'b',
    ]);
    expect([...(await flagsSvc.getEnabledFeatures(ORG, LOC))].sort()).toEqual([
      'b',
    ]);
  });

  it('saving an override audits, bumps access_version and drops the cache', async () => {
    const { flagsSvc, admin, audit, versions } = makeWorld({ catalog });
    expect((await flagsSvc.getEnabledFeatures(ORG, LOC)).has('a')).toBe(true);

    await admin.setLocationOverride(ORG, 'a', LOC, true, owner);
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      owner,
      expect.objectContaining({
        entityType: 'location_feature_override',
        action: AuditAction.CREATE,
        after: { featureKey: 'a', locationId: LOC, isDisabled: true },
      }),
    );
    expect(versions.bumpQuietly).toHaveBeenCalledWith(ORG);
    expect((await flagsSvc.getEnabledFeatures(ORG, LOC)).has('a')).toBe(false);

    // Clearing with no row is a no-op (nothing to narrow back).
    versions.bumpQuietly.mockClear();
    await admin.setLocationOverride(ORG, 'b', LOC, false, owner);
    expect(versions.bumpQuietly).not.toHaveBeenCalled();
  });

  it('refuses a location of another org', async () => {
    const { admin } = makeWorld({ catalog });
    await expect(
      admin.setLocationOverride(
        ORG,
        'a',
        '33333333-3333-3333-3333-333333333333',
        true,
        owner,
      ),
    ).rejects.toThrow('Location not found');
  });
});

describe('owner switch refuses features that are not entitled', () => {
  const catalog = [item('x', false), item('y', true)];

  it('403 NOT_ENTITLED for the owner, allowed for the super admin', async () => {
    const { admin, audit } = makeWorld({
      catalog,
      flags: [{ featureKey: 'x', isEnabled: false, isEntitled: false }],
    });
    const err = await admin
      .setEnabled(ORG, 'x', true, owner, { requireEntitled: true })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      code: 'NOT_ENTITLED',
      lockedReason: 'not_entitled',
    });
    expect(audit.record).not.toHaveBeenCalled();

    await expect(
      admin.setEnabled(ORG, 'x', true, platform, { requireEntitled: false }),
    ).resolves.toMatchObject({ isEnabled: true });
  });

  it('refuses an expired trial with lockedReason trial_expired', async () => {
    const { admin } = makeWorld({
      catalog,
      flags: [
        {
          featureKey: 'x',
          isEnabled: true,
          isEntitled: true,
          entitledUntil: new Date(Date.now() - 1000),
        },
      ],
    });
    await expect(
      admin.setEnabled(ORG, 'x', false, owner, { requireEntitled: true }),
    ).rejects.toMatchObject({
      response: { code: 'NOT_ENTITLED', lockedReason: 'trial_expired' },
    });
  });

  it('a feature with no row is entitled by default', async () => {
    const { admin } = makeWorld({ catalog });
    await expect(
      admin.setEnabled(ORG, 'y', false, owner, { requireEntitled: true }),
    ).resolves.toMatchObject({ isEnabled: false, isEntitled: true });
  });
});

describe('audit entries', () => {
  it('records before/after for a toggle and skips no-op saves', async () => {
    const { admin, audit } = makeWorld({
      catalog: [item('a', true)],
      flags: [{ featureKey: 'a', isEnabled: true, isEntitled: true }],
    });
    await admin.setEnabled(ORG, 'a', false, owner, { requireEntitled: true });
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      owner,
      expect.objectContaining({
        organizationId: ORG,
        entityType: 'org_feature_flag',
        action: AuditAction.UPDATE,
        before: expect.objectContaining({ isEnabled: true }),
        after: expect.objectContaining({ isEnabled: false }),
      }),
    );

    await admin.setEnabled(ORG, 'a', false, owner, { requireEntitled: true });
    expect(audit.record).toHaveBeenCalledTimes(1);
  });

  it('entitlement: new row, trial expiry stored, platform actor', async () => {
    const { admin, audit, flags } = makeWorld({ catalog: [item('z', false)] });
    const until = new Date(Date.now() + 86_400_000).toISOString();
    await admin.setEntitlement(ORG, 'z', { entitled: true, until }, platform);
    expect(flags[0]).toMatchObject({
      featureKey: 'z',
      isEntitled: true,
      isEnabled: false,
      entitledBy: 'sa-1',
    });
    expect(flags[0].entitledUntil?.toISOString()).toBe(until);
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      platform,
      expect.objectContaining({ action: AuditAction.CREATE }),
    );
  });

  it('bulk entitlement by module touches every feature of it', async () => {
    const { admin, audit } = makeWorld({
      catalog: [
        item('b.one', false, 'billing'),
        item('b.two', false, 'billing'),
        item('p.one', false, 'patients'),
      ],
    });
    await expect(
      admin.bulkSetEntitlement(
        ORG,
        { module: 'billing' },
        { entitled: false },
        platform,
      ),
    ).resolves.toEqual({ updated: 2 });
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it('rejects a trial expiry in the past', async () => {
    const { admin } = makeWorld({ catalog: [item('z')] });
    await expect(
      admin.setEntitlement(
        ORG,
        'z',
        { entitled: true, until: EARLIER.toISOString() },
        platform,
      ),
    ).rejects.toThrow('until must be in the future');
  });
});

describe('impact list', () => {
  it('lists the feature permissions and the roles that grant them', async () => {
    const { admin } = makeWorld({
      catalog: [item('billing.discounts', true)],
      roles: [
        // custom implies apply
        {
          id: 'r1',
          name: 'Manager',
          permissions: { 'billing.discount.custom': true },
        },
        { id: 'r2', name: 'Doctor', permissions: { 'patients.view': 'own' } },
      ],
    });
    const impact = await admin.getImpact(ORG, 'billing.discounts');
    expect(impact.permissions.map((p) => p.key).sort()).toEqual([
      'billing.discount.apply',
      'billing.discount.custom',
    ]);
    expect(impact.roles).toEqual([
      {
        id: 'r1',
        name: 'Manager',
        permissions: ['billing.discount.apply', 'billing.discount.custom'],
      },
    ]);
  });

  it('404s for an unknown feature', async () => {
    const { admin } = makeWorld({ catalog: [] });
    await expect(admin.getImpact(ORG, 'nope')).rejects.toThrow(
      'Unknown feature "nope"',
    );
  });
});

describe('owner view', () => {
  it('carries entitlement, lock reason and per-location overrides', async () => {
    const { admin } = makeWorld({
      catalog: [item('billing.discounts', true), item('dental.lab_orders')],
      flags: [
        {
          featureKey: 'dental.lab_orders',
          isEnabled: false,
          isEntitled: false,
        },
      ],
      overrides: [
        { locationId: LOC, featureKey: 'billing.discounts', isDisabled: true },
      ],
    });
    const view = await admin.getOwnerView(ORG);
    const features = view.modules.flatMap((m) => m.features);
    expect(features.find((f) => f.key === 'billing.discounts')).toMatchObject({
      entitled: true,
      enabled: true,
      active: true,
      lockedReason: null,
      permissionCount: 2,
      disabledLocationIds: [LOC],
    });
    expect(features.find((f) => f.key === 'dental.lab_orders')).toMatchObject({
      entitled: false,
      active: false,
      lockedReason: 'not_entitled',
    });
    expect(view.locations).toEqual([{ id: LOC, name: 'Main' }]);
  });
});

describe('AccessResolver uses the location features', () => {
  it('asks for the location set and drops permissions switched off there', async () => {
    const getEnabledFeatures = jest.fn((_org: string, loc?: string | null) =>
      Promise.resolve(
        new Set(
          loc ? ['patients.core'] : ['patients.core', 'billing.discounts'],
        ),
      ),
    );
    const resolver = new AccessResolver(
      {
        findOne: () => Promise.resolve({ uuid: 'u1', globalRole: null }),
      } as never,
      { findOne: () => Promise.resolve({ userId: 'u1' }) } as never, // owner
      { findOne: () => Promise.resolve(null) } as never,
      { getEnabledFeatures } as never,
      { current: () => Promise.resolve(1) } as never,
      { onChange: () => undefined } as never,
    );

    const atLocation = await resolver.resolve('u1', ORG, LOC);
    expect(getEnabledFeatures).toHaveBeenCalledWith(ORG, LOC);
    expect(atLocation.can('billing.discount.apply')).toBe(false);
    expect(atLocation.features).toEqual(['patients.core']);

    const orgWide = await resolver.resolve('u1', ORG, null);
    expect(getEnabledFeatures).toHaveBeenCalledWith(ORG, null);
    expect(orgWide.can('billing.discount.apply')).toBe(true);
  });
});
