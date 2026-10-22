import { ConflictException, HttpException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import type { PermissionMap } from 'src/access/catalog/permissions';
import { ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import type { AuditService } from 'src/common/audit/audit.service';
import { EmploymentRole } from './entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import { EmploymentRolesService, RoleActor } from './employment-roles.service';
import {
  addedGrants,
  bundleSummary,
  findEscalations,
  highRiskAdded,
  HOME_ROUTE_PATTERN,
} from './employment-roles.rules';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEmploymentRoleDto } from './dto/create-employment-role.dto';

const ORG = '00000000-0000-4000-8000-000000000001';

function makeRole(over: Partial<EmploymentRole> = {}): EmploymentRole {
  return {
    id: 'role-1',
    organizationId: ORG,
    name: 'Front desk',
    slug: 'front_desk',
    permissions: {},
    description: null,
    templateKey: null,
    homeRoute: null,
    isSystemRole: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as EmploymentRole;
}

function actor(
  permissions: PermissionMap,
  flags: { isOwner?: boolean; isSuperAdmin?: boolean } = {},
): RoleActor {
  return {
    access: {
      permissions,
      isOwner: flags.isOwner ?? false,
      isSuperAdmin: flags.isSuperAdmin ?? false,
    },
    audit: { userId: 'user-1', side: ActorSide.CLINIC },
  };
}

const OWNER = actor({}, { isOwner: true });

function setup(
  opts: { role?: EmploymentRole | null; memberCount?: number } = {},
) {
  const roles = new Map<string, EmploymentRole>();
  if (opts.role) roles.set(opts.role.id, opts.role);

  const roleRepo = {
    findOne: jest.fn(({ where }: { where: Record<string, string> }) => {
      if (where.id) return Promise.resolve(roles.get(where.id) ?? null);
      const bySlug = [...roles.values()].find((r) => r.slug === where.slug);
      return Promise.resolve(bySlug ?? null);
    }),
    find: jest.fn(() => Promise.resolve([...roles.values()])),
    create: jest.fn((v: Partial<EmploymentRole>) => ({ ...v })),
    save: jest.fn((v: EmploymentRole) => {
      const saved = { ...v, id: v.id ?? `role-${roles.size + 1}` };
      roles.set(saved.id, saved as EmploymentRole);
      return Promise.resolve(saved);
    }),
    remove: jest.fn((v: EmploymentRole) => {
      roles.delete(v.id);
      return Promise.resolve(v);
    }),
  };
  const assignmentRepo = {
    count: jest.fn(() => Promise.resolve(opts.memberCount ?? 0)),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === EmploymentRole ? roleRepo : assignmentRepo,
  };
  const dataSource = {
    transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
  };
  const audit = { record: jest.fn(() => Promise.resolve(true)) };

  const service = new EmploymentRolesService(
    roleRepo as unknown as Repository<EmploymentRole>,
    assignmentRepo as unknown as Repository<EmployeeOrgLocationAssignment>,
    dataSource as unknown as DataSource,
    audit as unknown as AuditService,
  );
  return { service, roleRepo, audit, roles };
}

/** The audit entry of the last `record()` call, written by `actor`. */
function expectAudit(
  audit: { record: jest.Mock },
  entry: Record<string, unknown>,
  actorRef: RoleActor = OWNER,
) {
  const calls = audit.record.mock.calls as unknown[][];
  const last = calls[calls.length - 1];
  expect(last[1]).toEqual(actorRef.audit);
  expect(last[2]).toMatchObject(entry);
}

/** The `{ code, ... }` body of a thrown HttpException. */
async function errorOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    return {
      status: (e as HttpException).getStatus(),
      body: (e as HttpException).getResponse() as Record<string, unknown>,
    };
  }
  throw new Error('expected a rejection');
}

describe('employment-roles rules', () => {
  it('lists only added or widened grants, implies included', () => {
    expect(
      addedGrants(
        { 'patients.view': 'own' },
        { 'patients.view': 'location', 'patients.create': true },
      ),
    ).toEqual({ 'patients.view': 'location', 'patients.create': true });
    expect(
      addedGrants({ 'patients.view': 'org' }, { 'patients.view': 'own' }),
    ).toEqual({});
  });

  it('flags permissions the actor lacks or holds narrower', () => {
    const held: PermissionMap = {
      'patients.view': 'location',
      'admin.roles.manage': true,
    };
    expect(findEscalations(held, {}, { 'patients.view': 'location' })).toEqual(
      [],
    );
    expect(findEscalations(held, {}, { 'patients.view': 'org' })).toEqual([
      'patients.view',
    ]);
    expect(findEscalations(held, {}, { 'billing.invoice.void': true })).toEqual(
      ['billing.invoice.void', 'billing.invoice.view'],
    ); // via implies
  });

  it('does not count grants the role already had', () => {
    const before: PermissionMap = { 'billing.invoice.void': true };
    expect(findEscalations({}, before, before)).toEqual([]);
    expect(highRiskAdded(before, before)).toEqual([]);
    expect(highRiskAdded({}, before)).toEqual(['billing.invoice.void']);
  });

  it('summarises bundle levels per module', () => {
    const summary = bundleSummary({
      'billing.desk.use': true,
      'billing.invoice.view': 'location',
      'billing.payment.collect': true,
      'patients.view': 'own',
    });
    expect(summary.Billing).toBe('basic');
    expect(summary.Patients).toBeNull();
    expect(summary.Lab).toBe('none');
  });

  it('accepts only relative in-app home routes', () => {
    expect(HOME_ROUTE_PATTERN.test('/queue/doctor')).toBe(true);
    expect(HOME_ROUTE_PATTERN.test('//evil.com')).toBe(false);
    expect(HOME_ROUTE_PATTERN.test('https://x.com')).toBe(false);
    expect(HOME_ROUTE_PATTERN.test('dashboard')).toBe(false);
  });
});

describe('CreateEmploymentRoleDto', () => {
  async function errors(body: object) {
    return validate(plainToInstance(CreateEmploymentRoleDto, body));
  }

  it('rejects unknown permission keys and scopes the permission does not allow', async () => {
    expect(
      await errors({ name: 'Ok', permissions: { 'x.y': true } }),
    ).not.toEqual([]);
    expect(
      await errors({ name: 'Ok', permissions: { 'patients.view': true } }),
    ).not.toEqual([]);
    expect(
      await errors({
        name: 'Ok',
        permissions: { 'patients.create': 'org' },
      }),
    ).not.toEqual([]);
    expect(
      await errors({
        name: 'Ok',
        permissions: { 'patients.view': 'own', 'patients.create': true },
        homeRoute: '/patients',
      }),
    ).toEqual([]);
  });

  it('rejects absolute home routes', async () => {
    expect(await errors({ name: 'Ok', homeRoute: '//evil.com' })).not.toEqual(
      [],
    );
  });
});

describe('EmploymentRolesService guardrails', () => {
  it('rejects invalid permission maps (service-level check too)', async () => {
    const { service } = setup();
    const err = await errorOf(
      service.create(
        ORG,
        { name: 'X', permissions: { 'patients.view': 'everywhere' } as never },
        OWNER,
      ),
    );
    expect(err.status).toBe(400);
    expect(err.body.code).toBe('INVALID_PERMISSIONS');
  });

  it('refuses escalation for a non-owner with 403 ESCALATION', async () => {
    const { service, audit } = setup();
    const manager = actor({
      'admin.roles.manage': true,
      'patients.view': 'location',
    });
    const err = await errorOf(
      service.create(
        ORG,
        {
          name: 'Biller',
          permissions: { 'patients.view': 'org', 'billing.desk.use': true },
        },
        manager,
      ),
    );
    expect(err.status).toBe(403);
    expect(err.body).toMatchObject({
      code: 'ESCALATION',
      permissions: ['patients.view', 'billing.desk.use'],
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('lets a non-owner grant what they hold', async () => {
    const { service } = setup();
    const manager = actor({
      'admin.roles.manage': true,
      'patients.view': 'location',
      'patients.create': true,
    });
    await expect(
      service.create(
        ORG,
        {
          name: 'Desk',
          permissions: { 'patients.view': 'location', 'patients.create': true },
        },
        manager,
      ),
    ).resolves.toMatchObject({ name: 'Desk', isSystemRole: false });
  });

  it('lets owners and super admins grant anything', async () => {
    const perms: PermissionMap = { 'billing.invoice.void': true };
    for (const who of [OWNER, actor({}, { isSuperAdmin: true })]) {
      const { service } = setup();
      await expect(
        service.create(
          ORG,
          { name: 'Voider', permissions: perms, reason: 'Accountant cover' },
          who,
        ),
      ).resolves.toBeDefined();
    }
  });

  it('requires a reason for newly granted high-risk permissions', async () => {
    const { service } = setup();
    const err = await errorOf(
      service.create(
        ORG,
        { name: 'Voider', permissions: { 'billing.invoice.void': true } },
        OWNER,
      ),
    );
    expect(err.status).toBe(400);
    expect(err.body).toMatchObject({
      code: 'REASON_REQUIRED',
      permissions: ['billing.invoice.void'],
    });
  });

  it('does not ask for a reason when the risky grant was already there', async () => {
    const role = makeRole({ permissions: { 'billing.invoice.void': true } });
    const { service } = setup({ role });
    await expect(
      service.update(
        role.id,
        ORG,
        {
          permissions: {
            'billing.invoice.void': true,
            'billing.desk.use': true,
          },
        },
        OWNER,
      ),
    ).resolves.toBeDefined();
  });

  it('keeps system roles read-only and undeletable', async () => {
    const role = makeRole({ isSystemRole: true, templateKey: 'doctor' });
    const { service, roleRepo } = setup({ role });

    const upd = await errorOf(
      service.update(role.id, ORG, { name: 'Dr' }, OWNER),
    );
    expect(upd.status).toBe(403);
    expect(upd.body.code).toBe('SYSTEM_ROLE_READ_ONLY');

    const del = await errorOf(service.remove(role.id, ORG, OWNER));
    expect(del.status).toBe(403);
    expect(roleRepo.remove).not.toHaveBeenCalled();
  });

  it('clones a system role into an editable custom role', async () => {
    const role = makeRole({
      id: 'sys-1',
      name: 'Doctor',
      slug: 'system_doctor',
      isSystemRole: true,
      templateKey: 'doctor',
      permissions: { 'patients.view': 'own' },
      homeRoute: '/queue/doctor',
    });
    const { service, audit } = setup({ role });
    const copy = await service.clone(role.id, ORG, {}, OWNER);
    expect(copy).toMatchObject({
      name: 'Doctor (copy)',
      isSystemRole: false,
      templateKey: null,
      homeRoute: '/queue/doctor',
      permissions: { 'patients.view': 'own' },
    });
    expectAudit(audit, {
      action: AuditAction.CREATE,
      after: { clonedFromId: 'sys-1' },
    });
  });

  it('refuses to delete a role with active members (409 + count)', async () => {
    const role = makeRole();
    const { service, roleRepo } = setup({ role, memberCount: 3 });
    const err = await errorOf(service.remove(role.id, ORG, OWNER));
    expect(err.status).toBe(409);
    expect(err.body).toMatchObject({
      code: 'ROLE_HAS_MEMBERS',
      memberCount: 3,
    });
    expect(roleRepo.remove).not.toHaveBeenCalled();
  });

  it('deletes an unused custom role and audits it', async () => {
    const role = makeRole({ permissions: { 'patients.view': 'own' } });
    const { service, roleRepo, audit } = setup({ role });
    await service.remove(role.id, ORG, OWNER);
    expect(roleRepo.remove).toHaveBeenCalled();
    expectAudit(audit, {
      entityType: 'employment_role',
      action: AuditAction.VOID,
      before: {
        permissions: { 'patients.view': 'own' },
      },
    });
  });

  it('audits updates with before/after permissions and the reason', async () => {
    const role = makeRole({ permissions: { 'patients.view': 'own' } });
    const { service, audit } = setup({ role });
    await service.update(
      role.id,
      ORG,
      {
        permissions: { 'patients.view': 'org', 'patients.export': true },
        reason: 'Monthly export for insurer',
      },
      OWNER,
    );
    expectAudit(audit, {
      organizationId: ORG,
      entityId: role.id,
      action: AuditAction.UPDATE,
      before: {
        permissions: { 'patients.view': 'own' },
      },
      after: {
        permissions: { 'patients.view': 'org', 'patients.export': true },
        reason: 'Monthly export for insurer',
      },
    });
  });

  it('audits creates', async () => {
    const { service, audit } = setup();
    await service.create(
      ORG,
      { name: 'Desk', permissions: { 'appointments.book': true } },
      OWNER,
    );
    expectAudit(audit, {
      action: AuditAction.CREATE,
      after: {
        name: 'Desk',
        permissions: { 'appointments.book': true },
      },
    });
  });

  it('rejects a duplicate role name', async () => {
    const { service } = setup({ role: makeRole() });
    await expect(
      service.create(ORG, { name: 'Front Desk' }, OWNER),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
