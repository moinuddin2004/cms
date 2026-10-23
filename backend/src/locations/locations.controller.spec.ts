import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccessContext } from 'src/access/access-context';
import type { AccessResolver } from 'src/access/access.resolver';
import type { PermissionMap } from 'src/access/catalog/permissions';
import type { AuthorizationService } from 'src/auth/services/authorization.service';
import { LocationsController } from './locations.controller';
import type { LocationsService } from './locations.service';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '99999999-9999-4999-8999-999999999999';
const LOC_A = '22222222-2222-4222-8222-222222222222';
const LOC_B = '33333333-3333-4333-8333-333333333333';

/** Which org a location belongs to (what the service returns). */
const LOCATIONS = {
  [LOC_A]: { id: LOC_A, organizationId: ORG_A, name: 'Main' },
  [LOC_B]: { id: LOC_B, organizationId: ORG_B, name: 'Other clinic' },
};

function ctx(organizationId: string, permissions: PermissionMap) {
  return new AccessContext({
    userId: USER,
    organizationId,
    locationId: null,
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId: null,
    features: [],
    permissions,
    roles: [],
    homeRoute: null,
  });
}

/** `grants[orgId]` = what the user holds in that org. */
function setup(
  grants: Record<string, PermissionMap>,
  { superAdmin = false } = {},
) {
  const resolver = {
    resolve: jest.fn((_u: string, orgId: string) =>
      Promise.resolve(ctx(orgId, grants[orgId] ?? {})),
    ),
  };
  const service = {
    findOne: jest.fn((id: string) =>
      Promise.resolve(LOCATIONS[id as keyof typeof LOCATIONS]),
    ),
    findAll: jest.fn().mockResolvedValue([]),
    findByOrganization: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'new' }),
    update: jest.fn().mockResolvedValue({}),
    deactivate: jest.fn().mockResolvedValue({}),
    getSettings: jest.fn().mockResolvedValue({}),
    updateSettings: jest.fn().mockResolvedValue({}),
  };
  const authorization = {
    isSuperAdmin: jest.fn().mockResolvedValue(superAdmin),
    resolveUserAccess: jest.fn().mockResolvedValue({
      accessibleOrganizations: [{ id: ORG_A }, { id: ORG_B }],
    }),
  };
  const subscriptions = {
    assertCanAddLocation: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new LocationsController(
    service as unknown as LocationsService,
    authorization as unknown as AuthorizationService,
    resolver as unknown as AccessResolver,
    subscriptions as unknown as SubscriptionsService,
  );
  return { controller, resolver, service, subscriptions };
}

function req(headers: Record<string, string> = {}) {
  return { user: { uuid: USER }, headers };
}

const MANAGE = { 'admin.locations.manage': true } as const;

describe('LocationsController permission resolution', () => {
  it('resolves the org from the location acted on, at that location', async () => {
    const { controller, resolver, service } = setup({ [ORG_A]: MANAGE });
    await controller.updateSettings(LOC_A, {} as never, req());
    expect(resolver.resolve).toHaveBeenCalledWith(USER, ORG_A, LOC_A);
    expect(service.updateSettings).toHaveBeenCalledWith(LOC_A, {});
  });

  it('refuses a location of another org, whatever the user holds at home', async () => {
    const { controller, resolver, service } = setup({ [ORG_A]: MANAGE });
    // the tenant header names org A, but location B belongs to org B
    await expect(
      controller.getSettings(LOC_B, req({ 'x-organization-id': ORG_A })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(resolver.resolve).toHaveBeenCalledWith(USER, ORG_B, LOC_B);
    expect(service.getSettings).not.toHaveBeenCalled();
  });

  it('owns more than one org: each location is checked in its own org', async () => {
    const { controller } = setup({ [ORG_A]: MANAGE, [ORG_B]: MANAGE });
    await expect(controller.findOne(LOC_A, req())).resolves.toBeTruthy();
    await expect(controller.findOne(LOC_B, req())).resolves.toBeTruthy();
  });

  it('refuses without admin.locations.manage', async () => {
    const { controller, service } = setup({
      [ORG_A]: { 'admin.settings.manage': true },
    });
    await expect(controller.deactivate(LOC_A, req())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(service.deactivate).not.toHaveBeenCalled();
  });

  it('create: org from the body, else the tenant header; checked there', async () => {
    const { controller, resolver, service } = setup({ [ORG_B]: MANAGE });
    await controller.create(
      { organizationId: ORG_B } as never,
      req({ 'x-organization-id': ORG_A, 'x-location-id': LOC_A }),
    );
    expect(resolver.resolve).toHaveBeenCalledWith(USER, ORG_B, LOC_A);
    expect(service.create).toHaveBeenCalledWith(ORG_B, expect.anything(), USER);

    await expect(
      controller.create({} as never, req({ 'x-organization-id': ORG_A })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.create({} as never, req())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('list: the active org for members, every location for super admins', async () => {
    const member = setup({ [ORG_A]: MANAGE });
    await member.controller.findAll(req({ 'x-organization-id': ORG_A }));
    expect(member.service.findByOrganization).toHaveBeenCalledWith(ORG_A);
    expect(member.service.findAll).not.toHaveBeenCalled();

    // No org named: every org where the user manages locations.
    const owner = setup({ [ORG_B]: MANAGE });
    await owner.controller.findAll(req());
    expect(owner.service.findByOrganization).toHaveBeenCalledTimes(1);
    expect(owner.service.findByOrganization).toHaveBeenCalledWith(ORG_B);
    await expect(setup({}).controller.findAll(req())).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    const sa = setup({}, { superAdmin: true });
    await sa.controller.findAll(req());
    expect(sa.service.findAll).toHaveBeenCalled();
    expect(sa.resolver.resolve).not.toHaveBeenCalled();
  });
});
