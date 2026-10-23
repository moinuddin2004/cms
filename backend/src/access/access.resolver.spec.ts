import { AccessResolver } from './access.resolver';
import { AccessChange } from './version/access-change-bus';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { PERMISSION_KEYS, PERMISSIONS } from './catalog/permissions';

const ORG = '11111111-1111-1111-1111-111111111111';
const LOC = '22222222-2222-2222-2222-222222222222';

interface World {
  globalRole?: string | null;
  owner?: boolean;
  assignment?: Record<string, unknown> | null;
  features?: string[];
  version?: number;
}

function setup(world: World) {
  let version = world.version ?? 1;
  const listeners: ((c: AccessChange) => void)[] = [];
  const userRepo = {
    findOne: jest.fn(() =>
      Promise.resolve({
        uuid: 'u1',
        globalRole: world.globalRole ?? null,
      }),
    ),
  };
  const ownershipRepo = {
    findOne: jest.fn(() =>
      Promise.resolve(
        world.owner ? { userId: 'u1', organizationId: ORG } : null,
      ),
    ),
  };
  const assignmentRepo = {
    findOne: jest.fn(() => Promise.resolve(world.assignment ?? null)),
  };
  const featureFlags = {
    getEnabledFeatures: jest.fn(() =>
      Promise.resolve(new Set(world.features ?? [])),
    ),
  };
  const versions = { current: jest.fn(() => Promise.resolve(version)) };
  const bus = { onChange: (l: (c: AccessChange) => void) => listeners.push(l) };
  const resolver = new AccessResolver(
    userRepo as never,
    ownershipRepo as never,
    assignmentRepo as never,
    featureFlags as never,
    versions as never,
    bus as never,
  );
  return {
    resolver,
    assignmentRepo,
    bump: () => (version += 1),
    emit: (c: AccessChange) => listeners.forEach((l) => l(c)),
  };
}

const role = (
  permissions: Record<string, unknown>,
  over: Record<string, unknown> = {},
) => ({
  id: 'r1',
  name: 'Front desk',
  organizationId: ORG,
  isActive: true,
  templateKey: 'receptionist',
  homeRoute: '/appointments',
  permissions,
  ...over,
});

const staff = (
  permissions: Record<string, unknown>,
  over: Record<string, unknown> = {},
) => ({
  employeeId: 'emp1',
  hasPortalAccess: true,
  employmentRole: role(permissions),
  ...over,
});

const ALL_FEATURES = [
  'patients.core',
  'appointments.core',
  'billing.invoices',
  'billing.discounts',
  'reports.financial',
];

describe('AccessResolver', () => {
  it('super admin gets every permission at full reach, minus disabled features', async () => {
    const { resolver } = setup({
      globalRole: GlobalRole.SUPER_ADMIN,
      features: ALL_FEATURES,
    });
    const ctx = await resolver.resolve('u1', ORG, null);
    expect(ctx.isSuperAdmin).toBe(true);
    expect(ctx.permissions['patients.view']).toBe('org');
    expect(ctx.permissions['billing.invoice.void']).toBe(true);
    expect(ctx.permissions['admin.roles.manage']).toBe(true);
    // feature off → dropped even for super admin
    expect(ctx.can('lab.orders.view')).toBe(false);
    expect(ctx.can('inventory.view')).toBe(false);
    expect(ctx.isMember).toBe(true);
  });

  it('owner gets everything regardless of role, with the employee id at the location', async () => {
    const all = [...PERMISSION_KEYS];
    const features = [...new Set(all.map((k) => PERMISSIONS[k].feature))];
    const { resolver } = setup({
      owner: true,
      features,
      assignment: staff({}, { hasPortalAccess: false }),
    });
    const ctx = await resolver.resolve('u1', ORG, LOC);
    expect(ctx.isOwner).toBe(true);
    expect(Object.keys(ctx.permissions).sort()).toEqual([...all].sort());
    expect(ctx.employeeId).toBe('emp1');
    expect(ctx.roles).toEqual([
      { id: 'r1', name: 'Front desk', templateKey: 'receptionist' },
    ]);
  });

  it('is fail-closed: {} role, legacy flags, no portal, inactive or foreign role', async () => {
    const cases = [
      staff({}),
      staff({
        canManageSettings: true,
        canCreateAppointments: true,
        canConsult: true,
      }),
      staff({ 'patients.view': 'org' }, { hasPortalAccess: false }),
      staff(
        {},
        {
          employmentRole: role({ 'patients.view': 'org' }, { isActive: false }),
        },
      ),
      staff(
        {},
        {
          employmentRole: role(
            { 'patients.view': 'org' },
            { organizationId: 'other' },
          ),
        },
      ),
      null,
    ];
    for (const assignment of cases) {
      const { resolver } = setup({ assignment, features: ALL_FEATURES });
      const ctx = await resolver.resolve('u1', ORG, LOC);
      expect(ctx.permissions).toEqual({});
    }
  });

  it('non-portal staff are not members; portal staff are', async () => {
    const off = setup({ assignment: staff({}, { hasPortalAccess: false }) });
    expect((await off.resolver.resolve('u1', ORG, LOC)).isMember).toBe(false);
    const on = setup({ assignment: staff({}) });
    expect((await on.resolver.resolve('u1', ORG, LOC)).isMember).toBe(true);
  });

  it('staff get their role permissions with scopes and implies, feature-filtered', async () => {
    const { resolver } = setup({
      features: ['patients.core', 'billing.invoices'],
      assignment: staff({
        'patients.view': 'location',
        'billing.invoice.void': true,
        'billing.discount.apply': true, // billing.discounts is off
      }),
    });
    const ctx = await resolver.resolve('u1', ORG, LOC);
    expect(ctx.permissions).toEqual({
      'patients.view': 'location',
      'billing.invoice.void': true,
      'billing.invoice.view': 'own',
    });
    expect(ctx.scope('patients.view')).toBe('location');
    expect(ctx.homeRoute).toBe('/appointments');
    expect(ctx.features).toEqual(['billing.invoices', 'patients.core']);
  });

  it('staff without a location get no role permissions', async () => {
    const { resolver, assignmentRepo } = setup({
      assignment: staff({ 'patients.view': 'org' }),
    });
    const ctx = await resolver.resolve('u1', ORG, null);
    expect(ctx.permissions).toEqual({});
    expect(assignmentRepo.findOne).not.toHaveBeenCalled();
  });

  it('caches per version and rebuilds after a bump', async () => {
    const w = setup({
      assignment: staff({ 'patients.view': 'own' }),
      features: ['patients.core'],
    });
    const a = await w.resolver.resolve('u1', ORG, LOC);
    const b = await w.resolver.resolve('u1', ORG, LOC);
    expect(b).toBe(a);
    expect(w.assignmentRepo.findOne).toHaveBeenCalledTimes(1);

    w.bump();
    const c = await w.resolver.resolve('u1', ORG, LOC);
    expect(c).not.toBe(a);
    expect(c.version).toBe(2);
    expect(w.assignmentRepo.findOne).toHaveBeenCalledTimes(2);

    // different location → separate entry
    await w.resolver.resolve('u1', ORG, '33333333-3333-3333-3333-333333333333');
    expect(w.assignmentRepo.findOne).toHaveBeenCalledTimes(3);
  });

  it("drops an org's cached contexts when the bus reports a change", async () => {
    const w = setup({ assignment: staff({}), features: [] });
    await w.resolver.resolve('u1', ORG, LOC);
    w.emit({ organizationId: ORG, version: 1 });
    await w.resolver.resolve('u1', ORG, LOC);
    expect(w.assignmentRepo.findOne).toHaveBeenCalledTimes(2);
  });
});
