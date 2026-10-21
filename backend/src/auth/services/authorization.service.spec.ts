import { AuthorizationService } from './authorization.service';
import { AppRole } from 'src/common/enums/app-role.enum';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { legacyRolesFromPermissions } from 'src/access/legacy-roles';

function service(opts: {
  superAdmin?: boolean;
  owner?: boolean;
  assignment?: Record<string, unknown> | null;
  anyAssignment?: boolean;
}) {
  const userRepo = {
    findOne: jest.fn(() =>
      Promise.resolve({
        uuid: 'u1',
        globalRole: opts.superAdmin ? GlobalRole.SUPER_ADMIN : null,
      }),
    ),
  };
  const ownershipRepo = {
    findOne: jest.fn(() => Promise.resolve(opts.owner ? {} : null)),
  };
  const assignmentRepo = {
    findOne: jest.fn(() => Promise.resolve(opts.assignment ?? null)),
    exists: jest.fn(() => Promise.resolve(!!opts.anyAssignment)),
  };
  const svc = new AuthorizationService(
    userRepo as never,
    ownershipRepo as never,
    {} as never,
    {} as never,
    {} as never,
    assignmentRepo as never,
  );
  return { svc, assignmentRepo };
}

const withRole = (
  permissions: Record<string, unknown>,
  over: Record<string, unknown> = {},
) => ({
  employeeId: 'emp1',
  hasPortalAccess: true,
  employmentRole: { isActive: true, permissions },
  ...over,
});

describe('AuthorizationService.resolveActor (fail-closed)', () => {
  it('gives no roles for an empty permission map (was receptionist + doctor)', async () => {
    const { svc } = service({ assignment: withRole({}) });
    expect((await svc.resolveActor('u1', 'o', 'l')).roles).toEqual([]);
  });

  it('ignores the legacy boolean flags', async () => {
    const { svc } = service({
      assignment: withRole({
        canManageSettings: true,
        canCreateAppointments: true,
        canConsult: true,
      }),
    });
    expect((await svc.resolveActor('u1', 'o', 'l')).roles).toEqual([]);
  });

  it('derives roles from new-format permissions', async () => {
    const { svc } = service({
      assignment: withRole({
        'admin.settings.manage': true,
        'billing.desk.use': true,
        'consultation.conduct': 'own',
      }),
    });
    const actor = await svc.resolveActor('u1', 'o', 'l');
    expect(actor.roles).toEqual([
      AppRole.CLINIC_ADMIN,
      AppRole.RECEPTIONIST,
      AppRole.DOCTOR,
    ]);
    expect(actor.employeeId).toBe('emp1');
  });

  it('gives nothing without portal access or with an inactive role', async () => {
    const noPortal = service({
      assignment: withRole(
        { 'appointments.book': true },
        { hasPortalAccess: false },
      ),
    });
    expect((await noPortal.svc.resolveActor('u1', 'o', 'l')).roles).toEqual([]);
    const inactive = service({
      assignment: withRole(
        {},
        {
          employmentRole: {
            isActive: false,
            permissions: { 'appointments.book': true },
          },
        },
      ),
    });
    expect((await inactive.svc.resolveActor('u1', 'o', 'l')).roles).toEqual([]);
  });

  it('owner and super admin still get every role', async () => {
    for (const opts of [{ owner: true }, { superAdmin: true }]) {
      const { svc } = service({ ...opts, assignment: withRole({}) });
      expect((await svc.resolveActor('u1', 'o', 'l')).roles).toEqual([
        AppRole.CLINIC_ADMIN,
        AppRole.RECEPTIONIST,
        AppRole.DOCTOR,
      ]);
    }
  });
});

describe('legacyRolesFromPermissions', () => {
  it('maps the documented permissions', () => {
    expect(legacyRolesFromPermissions({ 'admin.audit.view': true })).toEqual([
      AppRole.CLINIC_ADMIN,
    ]);
    expect(legacyRolesFromPermissions({ 'appointments.book': true })).toEqual([
      AppRole.RECEPTIONIST,
    ]);
    expect(legacyRolesFromPermissions({ 'billing.desk.use': true })).toEqual([
      AppRole.RECEPTIONIST,
    ]);
    expect(
      legacyRolesFromPermissions({ 'consultation.conduct': 'org' }),
    ).toEqual([AppRole.DOCTOR]);
    expect(legacyRolesFromPermissions({ 'patients.view': 'org' })).toEqual([]);
    expect(legacyRolesFromPermissions(null)).toEqual([]);
  });

  it('counts implied permissions (override_rules implies book)', () => {
    expect(
      legacyRolesFromPermissions({ 'appointments.override_rules': true }),
    ).toEqual([AppRole.RECEPTIONIST]);
  });
});

describe('AuthorizationService.canAccessOrganization', () => {
  it('super admin, owner, or an active portal assignment', async () => {
    expect(
      await service({ superAdmin: true }).svc.canAccessOrganization('u1', 'o'),
    ).toBe(true);
    expect(
      await service({ owner: true }).svc.canAccessOrganization('u1', 'o'),
    ).toBe(true);
    const member = service({ anyAssignment: true });
    expect(await member.svc.canAccessOrganization('u1', 'o')).toBe(true);
    expect(member.assignmentRepo.exists).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        organizationId: 'o',
        hasPortalAccess: true,
        isActive: true,
      },
    });
    expect(await service({}).svc.canAccessOrganization('u1', 'o')).toBe(false);
  });
});
