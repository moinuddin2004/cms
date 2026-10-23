import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from 'src/common/decorators/publicDecorator';
import { AccessGuard } from './access.guard';
import { AccessContext } from './access-context';
import { Access, AnyMember, Can } from './decorators/access.decorators';
import type { PermissionMap } from './catalog/permissions';

const ORG = '11111111-1111-1111-1111-111111111111';
const LOC = '22222222-2222-2222-2222-222222222222';

@Can('billing.desk.use')
class BillingController {
  @Can('billing.invoice.void')
  void() {}

  open() {}
}

class PlainController {
  open() {}

  @AnyMember()
  member() {}

  @Public()
  @Can('admin.roles.manage')
  publicRoute() {}

  @Can('patients.view', 'patients.view', 'patients.edit')
  duplicate() {}
}

function access(permissions: PermissionMap, isMember = true) {
  return new AccessContext({
    userId: 'u1',
    organizationId: ORG,
    locationId: LOC,
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember,
    employeeId: null,
    features: [],
    permissions,
    roles: [],
    homeRoute: null,
  });
}

function run(
  ctrl: new () => object,
  method: string,
  ctx: AccessContext,
  req: Record<string, unknown> = {},
) {
  const request: Record<string, unknown> = {
    user: { uuid: 'u1' },
    headers: { 'x-organization-id': ORG, 'x-location-id': LOC },
    ...req,
  };
  const resolver = { resolve: jest.fn(() => Promise.resolve(ctx)) };
  const guard = new AccessGuard(new Reflector(), resolver as never);
  const context = {
    getType: () => 'http',
    getHandler: () => (ctrl.prototype as Record<string, unknown>)[method],
    getClass: () => ctrl,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { promise: guard.canActivate(context), request, resolver };
}

async function rejection(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    return err as ForbiddenException;
  }
  throw new Error('expected a rejection');
}

describe('AccessGuard', () => {
  it('requires class AND method permissions (merged)', async () => {
    const both = run(
      BillingController,
      'void',
      access({
        'billing.desk.use': true,
        'billing.invoice.void': true,
      }),
    );
    await expect(both.promise).resolves.toBe(true);
    expect(both.request.access).toBeInstanceOf(AccessContext);

    const onlyMethod = run(
      BillingController,
      'void',
      access({ 'billing.invoice.void': true }),
    );
    const err = await rejection(onlyMethod.promise);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getStatus()).toBe(403);
    expect(err.getResponse()).toMatchObject({
      code: 'NO_PERMISSION',
      missing: ['billing.desk.use'],
    });

    const onlyClass = run(
      BillingController,
      'open',
      access({ 'billing.desk.use': true }),
    );
    await expect(onlyClass.promise).resolves.toBe(true);
  });

  it('lists every missing permission once', async () => {
    const r = run(PlainController, 'duplicate', access({}));
    expect((await rejection(r.promise)).getResponse()).toMatchObject({
      code: 'NO_PERMISSION',
      missing: ['patients.view', 'patients.edit'],
    });
  });

  it('routes without @Can pass and still get request.access', async () => {
    const r = run(PlainController, 'open', access({}));
    await expect(r.promise).resolves.toBe(true);
    expect(r.request.access).toBeDefined();
  });

  it('routes without @Can and without a tenant pass untouched', async () => {
    const r = run(PlainController, 'open', access({}), { headers: {} });
    await expect(r.promise).resolves.toBe(true);
    expect(r.resolver.resolve).not.toHaveBeenCalled();
  });

  it('@AnyMember needs an active member', async () => {
    await expect(
      run(PlainController, 'member', access({})).promise,
    ).resolves.toBe(true);
    const err = await rejection(
      run(PlainController, 'member', access({}, false)).promise,
    );
    expect(err.getResponse()).toMatchObject({
      code: 'NO_PERMISSION',
      missing: [],
    });
  });

  it('@Public skips everything', async () => {
    const r = run(PlainController, 'publicRoute', access({}), {
      user: undefined,
      headers: {},
    });
    await expect(r.promise).resolves.toBe(true);
    expect(r.resolver.resolve).not.toHaveBeenCalled();
  });

  it('@Can without an organization is refused', async () => {
    const err = await rejection(
      run(BillingController, 'open', access({ 'billing.desk.use': true }), {
        headers: {},
      }).promise,
    );
    expect(err.getResponse()).toMatchObject({
      code: 'NO_PERMISSION',
      missing: ['billing.desk.use'],
    });
  });

  it('prefers the validated tenant context over headers', async () => {
    const r = run(
      BillingController,
      'open',
      access({ 'billing.desk.use': true }),
      {
        headers: {},
        tenantContext: { organizationId: ORG, locationId: LOC },
      },
    );
    await expect(r.promise).resolves.toBe(true);
    expect(r.resolver.resolve).toHaveBeenCalledWith('u1', ORG, LOC);
  });
});

describe('@Access()', () => {
  it('is a param decorator factory', () => {
    expect(typeof Access).toBe('function');
  });
});
