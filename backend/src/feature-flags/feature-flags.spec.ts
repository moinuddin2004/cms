import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  FEATURE_CACHE_TTL_MS,
  FeatureFlagsService,
  resolveEnabledFeatures,
} from './feature-flags.service';
import { FEATURE_CATALOG_SEED } from './feature-catalog.seed';
import {
  FeatureFlagGuard,
  requiredFeaturesOf,
} from './guards/feature-flag.guard';
import { FeatureFlagsController } from './feature-flags.controller';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { AccessChange } from 'src/access/version/access-change-bus';

const ORG = 'org-1';

function makeService(opts: {
  catalog?: { key: string; module?: string; enabledByDefault: boolean }[];
  flags?: { featureKey: string; isEnabled: boolean }[];
  existingKeys?: string[];
}) {
  const listeners: ((c: AccessChange) => void)[] = [];
  const insert = { values: jest.fn(), orIgnore: jest.fn(), execute: jest.fn() };
  insert.values.mockReturnValue(insert);
  insert.orIgnore.mockReturnValue(insert);
  const qb: Record<string, jest.Mock> = { ...insert };
  qb.insert = jest.fn(() => qb);
  const catalogRepo = {
    find: jest.fn((args?: { select?: unknown }) =>
      Promise.resolve(
        args?.select
          ? (opts.existingKeys ?? []).map((key) => ({ key }))
          : (opts.catalog ?? []).map((c) => ({ module: 'm', ...c })),
      ),
    ),
    createQueryBuilder: jest.fn(() => qb),
    save: jest.fn(),
  };
  const flagRepo = { find: jest.fn(() => Promise.resolve(opts.flags ?? [])) };
  const logger = { info: jest.fn() };
  const bus = { onChange: (l: (c: AccessChange) => void) => listeners.push(l) };
  const svc = new FeatureFlagsService(
    catalogRepo as never,
    flagRepo as never,
    logger as never,
    bus as never,
  );
  return {
    svc,
    catalogRepo,
    flagRepo,
    insert,
    emit: (c: AccessChange) => listeners.forEach((l) => l(c)),
  };
}

describe('FeatureFlagsService.seedCatalog (insert missing only)', () => {
  it('inserts only keys not in the catalog and never saves existing rows', async () => {
    const existing = FEATURE_CATALOG_SEED.slice(1).map((s) => s.key);
    const { svc, catalogRepo, insert } = makeService({
      existingKeys: existing,
    });
    await svc.onModuleInit();
    expect(catalogRepo.save).not.toHaveBeenCalled();
    expect(insert.values).toHaveBeenCalledWith([FEATURE_CATALOG_SEED[0]]);
    expect(insert.orIgnore).toHaveBeenCalled();
  });

  it('does nothing when every key exists', async () => {
    const { svc, insert } = makeService({
      existingKeys: FEATURE_CATALOG_SEED.map((s) => s.key),
    });
    await svc.seedCatalog();
    expect(insert.values).not.toHaveBeenCalled();
  });
});

describe('enabled features fall back to the catalog default', () => {
  const catalog = [
    { key: 'a.default_on', enabledByDefault: true },
    { key: 'b.default_off', enabledByDefault: false },
    { key: 'c.default_on_but_off', enabledByDefault: true },
  ];
  const flags = [
    { featureKey: 'c.default_on_but_off', isEnabled: false },
    { featureKey: 'd.enabled_row', isEnabled: true },
  ];

  it('resolveEnabledFeatures', () => {
    expect([...resolveEnabledFeatures(flags, catalog)].sort()).toEqual([
      'a.default_on',
      'd.enabled_row',
    ]);
  });

  it('getEnabledFeatures and getCatalogWithOrgStatus agree', async () => {
    const { svc } = makeService({ catalog, flags });
    expect([...(await svc.getEnabledFeatures(ORG))].sort()).toEqual([
      'a.default_on',
      'd.enabled_row',
    ]);
    const status = (await svc.getCatalogWithOrgStatus(ORG)).flatMap(
      (g) => g.features,
    );
    expect(Object.fromEntries(status.map((f) => [f.key, f.isEnabled]))).toEqual(
      {
        'a.default_on': true,
        'b.default_off': false,
        'c.default_on_but_off': false,
      },
    );
  });
});

describe('feature cache', () => {
  it('is dropped when the access bus reports a change for the org (any instance)', async () => {
    const { svc, flagRepo, emit } = makeService({ catalog: [], flags: [] });
    await svc.getEnabledFeatures(ORG);
    await svc.getEnabledFeatures(ORG);
    expect(flagRepo.find).toHaveBeenCalledTimes(1);
    emit({ organizationId: ORG, version: 2 });
    await svc.getEnabledFeatures(ORG);
    expect(flagRepo.find).toHaveBeenCalledTimes(2);
  });

  it('expires after the TTL', async () => {
    const { svc, flagRepo } = makeService({ catalog: [], flags: [] });
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    await svc.getEnabledFeatures(ORG);
    now.mockReturnValue(1_000 + FEATURE_CACHE_TTL_MS + 1);
    await svc.getEnabledFeatures(ORG);
    expect(flagRepo.find).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
});

describe('FeatureFlagGuard merges class + method features', () => {
  @RequireFeature('billing.invoices')
  class Ctrl {
    @RequireFeature('billing.discounts')
    discount() {}

    plain() {}
  }

  const context = (method: keyof Ctrl) =>
    ({
      getHandler: () => Ctrl.prototype[method],
      getClass: () => Ctrl,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { uuid: 'u1' },
          headers: { 'x-organization-id': ORG },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('collects both keys', () => {
    expect(requiredFeaturesOf(new Reflector(), context('discount'))).toEqual([
      'billing.discounts',
      'billing.invoices',
    ]);
    expect(requiredFeaturesOf(new Reflector(), context('plain'))).toEqual([
      'billing.invoices',
    ]);
  });

  it('refuses when only the method-level feature is on', async () => {
    const guard = new FeatureFlagGuard(
      new Reflector(),
      { isSuperAdmin: () => Promise.resolve(false) } as never,
      {
        getEnabledFeatures: () =>
          Promise.resolve(new Set(['billing.discounts'])),
      } as never,
    );
    await expect(guard.canActivate(context('discount'))).rejects.toThrow(
      /billing.invoices/,
    );
    const ok = new FeatureFlagGuard(
      new Reflector(),
      { isSuperAdmin: () => Promise.resolve(false) } as never,
      {
        getEnabledFeatures: () =>
          Promise.resolve(new Set(['billing.discounts', 'billing.invoices'])),
      } as never,
    );
    await expect(ok.canActivate(context('discount'))).resolves.toBe(true);
  });
});

describe('GET /feature-flags/my-features membership check', () => {
  const controller = (member: boolean) =>
    new FeatureFlagsController(
      { getEnabledFeatures: () => Promise.resolve(new Set(['x'])) } as never,
      {
        canAccessOrganization: jest.fn(() => Promise.resolve(member)),
      } as never,
    );

  it('refuses an org the user does not belong to', async () => {
    await expect(
      controller(false).getMyFeatures({
        user: { uuid: 'u1' },
        headers: { 'x-organization-id': ORG },
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns the features for a member', async () => {
    const res = await controller(true).getMyFeatures({
      user: { uuid: 'u1' },
      headers: { 'x-organization-id': ORG },
    } as never);
    expect(res.data).toEqual(['x']);
  });
});
