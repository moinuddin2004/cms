import { AuditLog } from 'src/common/audit/entities/audit-log.entity';
import { AccessChangeBus } from 'src/access/version/access-change-bus';
import type { MeAccess } from 'src/access/access.controller';
import {
  addStaff,
  bootApp,
  dataOf,
  Env,
  errorOf,
  seedWorld,
} from './harness';

interface RoleDto {
  id: string;
  name: string;
  isSystemRole: boolean;
  memberCount: number;
  permissions: Record<string, unknown>;
  bundles: Record<string, string | null>;
  homeRoute: string | null;
}

/** Section 4 — Roles & bundles (AC-ROLE). ROLE-14..17 are UI cases (vitest). */
describe('AC-ROLE roles & bundles', () => {
  let env: Env;
  let w: Env['world'];

  const roleAudit = async (entityId: string) =>
    env.ds.getRepository(AuditLog).find({
      where: { organizationId: w.orgA, entityType: 'employment_role', entityId },
      order: { createdAt: 'ASC' },
    });
  const created = async (name: string, permissions: object, who = w.people.OwnerA) =>
    dataOf<RoleDto>(
      await env.post('/admin/roles', who, { name, permissions }).expect(201),
    );

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'role');
  }, 900_000);
  afterAll(async () => env?.close());

  it('ROLE-01 list roles: 5 system roles + custom, member counts, bundle match', async () => {
    await created('Extra custom', { 'patients.view': 'org' });
    const list = dataOf<RoleDto[]>(
      await env.get('/admin/roles', w.people.AdminU).expect(200),
    );
    const system = list.filter((r) => r.isSystemRole);
    expect(system.map((r) => r.name).sort()).toEqual([
      'Accountant',
      'Admin',
      'Assistant',
      'Doctor',
      'Receptionist',
    ]);
    expect(list.some((r) => !r.isSystemRole)).toBe(true);
    const doctor = list.find((r) => r.name === 'Doctor')!;
    expect(doctor.memberCount).toBeGreaterThanOrEqual(2); // Doc1, Doc2 (+MultiU at L2, NoPortalU)
    expect(doctor.bundles).toBeDefined();
    expect(Object.keys(doctor.bundles).length).toBeGreaterThan(5);
  });

  it('ROLE-02 create a custom role, usable in an assignment', async () => {
    const role = await created('Nurse', {
      'patients.view': 'location',
      'appointments.view': 'location',
    });
    expect(role.name).toBe('Nurse');
    const { person } = await addStaff(env, 'NurseUser', {}, { roleId: role.id });
    const me = dataOf<MeAccess>(await env.get('/me/access', person).expect(200));
    expect(me.permissions['patients.view']).toBe('location');
    expect(me.roles.map((r) => r.name)).toContain('Nurse');
  });

  it('ROLE-03 unknown key rejected → 400', async () => {
    await env
      .post('/admin/roles', w.people.OwnerA, {
        name: 'Bad key',
        permissions: { 'foo.bar': true },
      })
      .expect(400);
  });

  it('ROLE-04 invalid scope rejected → 400', async () => {
    await env
      .post('/admin/roles', w.people.OwnerA, {
        name: 'Bad scope A',
        permissions: { 'billing.desk.use': 'own' },
      })
      .expect(400);
    await env
      .post('/admin/roles', w.people.OwnerA, {
        name: 'Bad scope B',
        permissions: { 'patients.view': 'galaxy' },
      })
      .expect(400);
  });

  it('ROLE-05 no escalation: grant of a key the actor lacks → 403 ESCALATION', async () => {
    const { person } = await addStaff(env, 'RoleMgr', {
      'admin.roles.manage': true,
    });
    const res = await env
      .post('/admin/roles', person, {
        name: 'Escalator',
        permissions: { 'billing.invoice.void': true },
        reason: 'because',
      })
      .expect(403);
    const err = errorOf(res);
    expect(err.code).toBe('ESCALATION');
    expect(err.permissions).toContain('billing.invoice.void');
  });

  it('ROLE-06 no scope escalation: location → org is refused', async () => {
    const { person } = await addStaff(env, 'ScopeMgr', {
      'admin.roles.manage': true,
      'patients.view': 'location',
    });
    const res = await env
      .post('/admin/roles', person, {
        name: 'Scope escalator',
        permissions: { 'patients.view': 'org' },
      })
      .expect(403);
    expect(errorOf(res).code).toBe('ESCALATION');
    // …while granting the actor's own reach is fine.
    await env
      .post('/admin/roles', person, {
        name: 'Same scope',
        permissions: { 'patients.view': 'location' },
      })
      .expect(201);
  });

  it('ROLE-07 owner bypasses escalation', async () => {
    await env
      .post('/admin/roles', w.people.OwnerA, {
        name: 'Owner grants all',
        permissions: {
          'billing.invoice.void': true,
          'payroll.manage': true,
          'patients.view': 'org',
        },
        reason: 'owner decision',
      })
      .expect(201);
  });

  it('ROLE-08 system role is read-only; the clone is editable', async () => {
    const adminRole = w.roles.admin;
    const patch = await env.patch(`/admin/roles/${adminRole}`, w.people.OwnerA, {
      name: 'Hacked admin',
    });
    expect(patch.status).toBeGreaterThanOrEqual(400);
    expect(patch.status).toBeLessThan(500);
    const del = await env.del(`/admin/roles/${adminRole}`, w.people.OwnerA);
    expect(del.status).toBeGreaterThanOrEqual(400);
    expect(del.status).toBeLessThan(500);
    const clone = dataOf<RoleDto>(
      await env
        .post(`/admin/roles/${adminRole}/clone`, w.people.OwnerA, {
          name: 'Admin clone',
          reason: 'clinic wants a variant',
        })
        .expect(201),
    );
    expect(clone.isSystemRole).toBe(false);
    await env
      .patch(`/admin/roles/${clone.id}`, w.people.OwnerA, {
        description: 'edited clone',
      })
      .expect(200);
  });

  it('ROLE-09 delete a role with members → 409 with member count', async () => {
    const clone = dataOf<RoleDto>(
      await env
        .post(`/admin/roles/${w.roles.receptionist}/clone`, w.people.OwnerA, {
          name: 'Receptionist clone',
        })
        .expect(201),
    );
    await addStaff(env, 'CloneMember', {}, { roleId: clone.id });
    const res = await env
      .del(`/admin/roles/${clone.id}`, w.people.OwnerA)
      .expect(409);
    const err = errorOf(res);
    expect(err.code).toBe('ROLE_HAS_MEMBERS');
    expect(err.memberCount).toBe(1);
  });

  it('ROLE-10 high-risk grant needs a reason; the reason is stored in the audit row', async () => {
    const role = await created('Refund tester', { 'patients.view': 'location' });
    const without = await env
      .patch(`/admin/roles/${role.id}`, w.people.OwnerA, {
        permissions: { 'patients.view': 'location', 'billing.refund.issue': true },
      })
      .expect(400);
    expect(errorOf(without).code).toBe('REASON_REQUIRED');
    await env
      .patch(`/admin/roles/${role.id}`, w.people.OwnerA, {
        permissions: { 'patients.view': 'location', 'billing.refund.issue': true },
        reason: 'Accounts desk covers refunds',
      })
      .expect(200);
    const rows = await roleAudit(role.id);
    const last = rows[rows.length - 1];
    expect(JSON.stringify(last.changes)).toContain('Accounts desk covers refunds');
  });

  it('ROLE-11 audit: create, update, clone, delete → one row each with before/after', async () => {
    const role = await created('Audited', { 'patients.view': 'own' });
    expect(await roleAudit(role.id)).toHaveLength(1);

    await env
      .patch(`/admin/roles/${role.id}`, w.people.OwnerA, {
        permissions: { 'patients.view': 'org' },
      })
      .expect(200);
    const afterUpdate = await roleAudit(role.id);
    expect(afterUpdate).toHaveLength(2);
    const changes = JSON.stringify(afterUpdate[1].changes);
    expect(changes).toContain('permissions');
    expect(changes).toContain('own');
    expect(changes).toContain('org');

    const clone = dataOf<RoleDto>(
      await env
        .post(`/admin/roles/${role.id}/clone`, w.people.OwnerA, { name: 'Audited copy' })
        .expect(201),
    );
    expect(await roleAudit(clone.id)).toHaveLength(1);

    await env.del(`/admin/roles/${clone.id}`, w.people.OwnerA).expect(200);
    const afterDelete = await roleAudit(clone.id);
    expect(afterDelete).toHaveLength(2);
    expect(JSON.stringify(afterDelete[1].changes)).toContain('Audited copy');
  });

  it('ROLE-12 role edit bumps access_version, applies at once, emits access.changed', async () => {
    const role = await created('Live role', { 'patients.view': 'location' });
    const { person } = await addStaff(env, 'LiveMember', {}, { roleId: role.id });
    const bus = env.app.get(AccessChangeBus);
    const events: { organizationId: string; version: number }[] = [];
    const stop = bus.onChange((c) => events.push(c));
    try {
      const before = await env.version();
      await env
        .patch(`/admin/roles/${role.id}`, w.people.OwnerA, {
          permissions: { 'patients.view': 'org', 'appointments.view': 'org' },
        })
        .expect(200);
      expect(await env.version()).toBe(before + 1);
      const me = dataOf<MeAccess>(await env.get('/me/access', person).expect(200));
      expect(me.version).toBe(before + 1);
      expect(me.permissions['patients.view']).toBe('org');
      expect(me.permissions['appointments.view']).toBe('org');
      expect(events).toContainEqual({
        organizationId: w.orgA,
        version: before + 1,
      });
    } finally {
      stop();
    }
  });

  it('ROLE-13 homeRoute validation: external URL and relative word → 400', async () => {
    for (const homeRoute of ['https://evil.com', 'dashboard', '//evil.com']) {
      await env
        .post('/admin/roles', w.people.OwnerA, {
          name: `Home ${homeRoute.length}`,
          permissions: {},
          homeRoute,
        })
        .expect(400);
    }
    await env
      .post('/admin/roles', w.people.OwnerA, {
        name: 'Home ok',
        permissions: {},
        homeRoute: '/queue/doctor',
      })
      .expect(201);
  });

  it('ROLE-18 legacy /employment-roles CRUD needs admin.roles.manage', async () => {
    await env
      .post('/employment-roles', w.people.RecU, { name: 'Sneaky', permissions: {} })
      .expect(403);
    const made = await env
      .post('/employment-roles', w.people.AdminU, {
        name: 'Via legacy',
        permissions: { 'patients.view': 'location' },
      })
      .expect(201);
    const id = dataOf<{ id: string }>(made).id;
    await env
      .put(`/employment-roles/${id}`, w.people.RecU, { description: 'x' })
      .expect(403);
    await env
      .put(`/employment-roles/${id}`, w.people.AdminU, { description: 'x' })
      .expect(200);
    await env.del(`/employment-roles/${id}`, w.people.RecU).expect(403);
    await env.del(`/employment-roles/${id}`, w.people.AdminU).expect(200);
    await env.get('/employment-roles', w.people.RecU).expect(403);
    await env.get('/employment-roles', w.people.AdminU).expect(200);
  });
});
