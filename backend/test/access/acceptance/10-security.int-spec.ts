import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { User } from 'src/user/entities/user.entity';
import type { MeAccess } from 'src/access/access.controller';
import {
  addStaff,
  bootApp,
  dataOf,
  Env,
  errorOf,
  note,
  seedWorld,
} from './harness';

/** Section 10 — Security & tenant isolation (AC-SEC). SEC-05 is a unit case (src/access/acceptance). */
describe('AC-SEC security & tenant isolation', () => {
  let env: Env;
  let w: Env['world'];

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'sec');
  }, 900_000);
  afterAll(async () => env?.close());

  it('SEC-01 cross-tenant: AdminU with x-organization-id = OrgB → 403 everywhere', async () => {
    const urls = ['/patients', '/admin/roles', '/employees', '/inventory/items', '/me/access'];
    for (const loc of [w.LB1, w.L1]) {
      for (const u of urls) {
        const res = await env.get(u, w.people.AdminU, { org: w.orgB, loc });
        expect({ u, loc, status: res.status }).toEqual({ u, loc, status: 403 });
      }
    }
    // Without a location header the org check still refuses (/me/access has no location requirement).
    expect((await env.get('/me/access', w.people.AdminU, { org: w.orgB, loc: null })).status).toBe(403);
    // A write too.
    const res = await env.post('/patients', w.people.AdminU, { fullName: 'X', phone: '03000000000' }, {
      org: w.orgB,
      loc: w.LB1,
    });
    expect(res.status).toBe(403);
  });

  it('SEC-02 header spoof: RecU with x-location-id = L2 (no assignment) → 403', async () => {
    const asL2 = { loc: w.L2 };
    expect((await env.get('/patients', w.people.RecU, asL2)).status).toBe(403);
    expect((await env.get('/me/access', w.people.RecU, asL2)).status).toBe(403);
    expect((await env.get('/appointments', w.people.RecU, asL2)).status).toBe(403);
    // Their own location still works.
    await env.get('/patients', w.people.RecU).expect(200);
  });

  it('SEC-03 deactivated employee: the next request has no permissions', async () => {
    const { person } = await addStaff(env, 'Leaver', { 'patients.view': 'org' });
    await env.get('/patients', person).expect(200);
    const v = await env.version();
    const repo = env.ds.getRepository(EmployeeOrgLocationAssignment);
    const a = await repo.findOneByOrFail({ id: person.assignmentId! });
    a.isActive = false;
    await repo.save(a);
    expect(await env.version()).toBeGreaterThan(v);
    await env.get('/patients', person).expect(403);
    expect((await env.get('/me/access', person)).status).toBe(403);
  });

  it('SEC-04 removed ownership: the owner bypass is gone on the next request', async () => {
    const u = await env.ds.getRepository(User).save({
      email: `owner2.${Date.now()}@acceptance-it.test`,
      name: 'Second owner',
    } as Partial<User>);
    const who = {
      userId: u.uuid,
      employeeId: null,
      assignmentId: null,
      orgId: w.orgA,
      locId: w.L1,
    };
    const repo = env.ds.getRepository(OrganizationOwnership);
    const row = await repo.save({
      userId: u.uuid,
      organizationId: w.orgA,
      isPrimaryOwner: false,
    } as Partial<OrganizationOwnership>);
    await env.get('/admin/roles', who).expect(200);
    await repo.remove(row);
    const res = await env.get('/admin/roles', who);
    expect([403]).toContain(res.status);
    expect((await env.get('/me/access', who)).status).toBe(403);
  });

  it('SEC-06 owner lockout impossible: the owner who clears their own assignment role keeps full access', async () => {
    const { person } = await addStaff(env, 'OwnerStaff', { 'patients.view': 'own' });
    await env.ds.getRepository(OrganizationOwnership).save({
      userId: person.userId,
      organizationId: w.orgA,
      isPrimaryOwner: false,
    } as Partial<OrganizationOwnership>);
    const repo = env.ds.getRepository(EmployeeOrgLocationAssignment);
    const a = await repo.findOneByOrFail({ id: person.assignmentId! });
    a.employmentRoleId = null;
    await repo.save(a);
    const me = dataOf<MeAccess>(await env.get('/me/access', person).expect(200));
    expect(me.isOwner).toBe(true);
    expect(me.permissions['admin.roles.manage']).toBe(true);
    expect(me.permissions['patients.view']).toBe('org');
    await env.get('/admin/roles', person).expect(200);
    // …and via the API: the owner clears the role of their own assignment.
    note('SEC-06', 'role cleared through the repository; the owner flag is independent of the assignment role');
  });

  it('SEC-07 commission doctor detection: only a role granting consultation.conduct counts', async () => {
    const owner = w.people.OwnerA;
    const plan = { type: 'COMMISSION', defaultRateBps: 1000 };
    const create = (assignmentId: string) =>
      env.post(`/assignments/${assignmentId}/compensation-plans`, owner, plan);

    const doctor = await create(w.people.Doc1.assignmentId!);
    expect([200, 201]).toContain(doctor.status);

    const rec = await create(w.people.RecU.assignmentId!);
    expect(rec.status).toBe(422);
    expect(errorOf(rec).code).toBe('COMMISSION_ROLE_CANNOT_CONSULT');

    // LegacyU's role stores `canConsult: true` — the old flag is ignored.
    const legacy = await create(w.people.LegacyU.assignmentId!);
    expect(legacy.status).toBe(422);
    expect(errorOf(legacy).code).toBe('COMMISSION_ROLE_CANNOT_CONSULT');

    // No role at all.
    const norole = await create(w.people.NoRoleU.assignmentId!);
    expect(norole.status).toBe(422);
  });
});
