import { join } from 'path';
import { sign } from 'jsonwebtoken';
import { AddressInfo } from 'net';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { User } from 'src/user/entities/user.entity';
import {
  addStaff,
  bootApp,
  dataOf,
  Env,
  Person,
  seedWorld,
} from './harness';
import type { MeAccess } from 'src/access/access.controller';

/* The web app owns socket.io-client; the backend does not depend on it. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { io } = require(
  join(__dirname, '../../../../web-app/node_modules/socket.io-client'),
) as typeof import('socket.io-client');

/** Section 9 — Realtime & cache invalidation (AC-RT). RT-04 / RT-06 are UI cases (vitest). */
describe('AC-RT realtime & cache invalidation', () => {
  let env: Env;
  let w: Env['world'];
  let base: string;
  const sockets: ReturnType<typeof io>[] = [];

  const connect = (who: Person) =>
    new Promise<ReturnType<typeof io>>((resolve, reject) => {
      const s = io(`${base}/realtime`, {
        transports: ['websocket'],
        auth: {
          token: sign({ sub: who.userId }, process.env.JWT_ACCESS_SECRET!, {
            expiresIn: '1h',
          }),
        },
        forceNew: true,
      });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  const subscribe = (s: ReturnType<typeof io>, room: string) =>
    new Promise<{ ok: boolean; error?: string }>((resolve) =>
      s.emit('subscribe', { room }, resolve),
    );

  beforeAll(async () => {
    env = await bootApp({ realtime: true });
    w = await seedWorld(env, 'rt');
    const addr = env.app.getHttpServer().address() as AddressInfo;
    base = `http://127.0.0.1:${addr.port}`;
  }, 900_000);
  afterAll(async () => {
    for (const s of sockets) s.close();
    await env?.close();
  });

  it('RT-01 every access-relevant change bumps organizations.access_version', async () => {
    const bumps: Record<string, boolean> = {};
    const check = async (name: string, change: () => Promise<unknown>) => {
      const before = await env.version();
      await change();
      bumps[name] = (await env.version()) > before;
    };
    const { person, roleId } = await addStaff(env, 'Bumper', {
      'patients.view': 'location',
    });
    const roleRepo = env.ds.getRepository(EmploymentRole);
    const assignRepo = env.ds.getRepository(EmployeeOrgLocationAssignment);

    await check('role permissions', async () => {
      const r = await roleRepo.findOneByOrFail({ id: roleId });
      r.permissions = { 'patients.view': 'org' };
      await roleRepo.save(r);
    });
    await check('assignment role', async () => {
      const a = await assignRepo.findOneByOrFail({ id: person.assignmentId! });
      a.employmentRoleId = w.roles.assistant;
      await assignRepo.save(a);
    });
    await check('assignment portal', async () => {
      const a = await assignRepo.findOneByOrFail({ id: person.assignmentId! });
      a.hasPortalAccess = false;
      await assignRepo.save(a);
    });
    await check('assignment active', async () => {
      const a = await assignRepo.findOneByOrFail({ id: person.assignmentId! });
      a.isActive = false;
      await assignRepo.save(a);
    });
    await check('org feature flag', () =>
      env.flags.toggleFeature(w.orgA, 'inventory.core', false),
    );
    await env.flags.toggleFeature(w.orgA, 'inventory.core', true);
    await check('location override', () =>
      env
        .put(`/admin/features/dental.lab_orders/locations/${w.L2}`, w.people.OwnerA, {
          disabled: true,
        })
        .expect(200),
    );
    await env
      .put(`/admin/features/dental.lab_orders/locations/${w.L2}`, w.people.OwnerA, {
        disabled: false,
      })
      .expect(200);
    await check('ownership', async () => {
      const u = await env.ds.getRepository(User).save({
        email: `co-owner.${Date.now()}@acceptance-it.test`,
        name: 'Co owner',
      } as Partial<User>);
      await env.ds.getRepository(OrganizationOwnership).save({
        userId: u.uuid,
        organizationId: w.orgA,
        isPrimaryOwner: false,
      } as Partial<OrganizationOwnership>);
    });
    await check('nav layout', () =>
      env
        .put('/admin/navigation', w.people.OwnerA, {
          sections: [{ items: [{ key: 'nav.dashboard' }] }],
        })
        .expect(200),
    );
    expect(bumps).toEqual({
      'role permissions': true,
      'assignment role': true,
      'assignment portal': true,
      'assignment active': true,
      'org feature flag': true,
      'location override': true,
      ownership: true,
      'nav layout': true,
    });
  });

  it('RT-02 socket room: a member joins org:<id>; a user of another org is refused', async () => {
    const rec = await connect(w.people.RecU);
    expect(await subscribe(rec, `org:${w.orgA}`)).toMatchObject({ ok: true });
    const other = await connect(w.people.OwnerB);
    const refused = await subscribe(other, `org:${w.orgA}`);
    expect(refused.ok).toBe(false);
    // …and the other org's own room is open to it.
    expect(await subscribe(other, `org:${w.orgB}`)).toMatchObject({ ok: true });
  });

  it('RT-03 event: changing a role after subscribing delivers access.changed {organizationId, version}', async () => {
    const rec = await connect(w.people.RecU);
    expect(await subscribe(rec, `org:${w.orgA}`)).toMatchObject({ ok: true });
    const { roleId } = await addStaff(env, 'EventRole', { 'patients.view': 'own' });
    const before = await env.version();
    // Earlier bumps (creating the role) may still be in flight on the socket:
    // wait for the first event newer than `before`.
    const got = new Promise<{ organizationId: string; version: number }>(
      (resolve, reject) => {
        const t = setTimeout(() => reject(new Error('no newer access.changed in 15s')), 15_000);
        rec.on('access.changed', (p: { organizationId: string; version: number }) => {
          if (p.version <= before) return;
          clearTimeout(t);
          resolve(p);
        });
      },
    );
    await env
      .patch(`/admin/roles/${roleId}`, w.people.OwnerA, {
        permissions: { 'patients.view': 'org' },
      })
      .expect(200);
    const event = await got;
    expect(event.organizationId).toBe(w.orgA);
    expect(event.version).toBeGreaterThan(before);
    expect(event.version).toBe(await env.version());
  });

  it('RT-05 cache keyed by version: a role change applies to the very next call', async () => {
    const { person, roleId } = await addStaff(env, 'CacheProbe', {});
    await env.get('/patients', person).expect(403);
    const roleRepo = env.ds.getRepository(EmploymentRole);
    const r = await roleRepo.findOneByOrFail({ id: roleId });
    r.permissions = { 'patients.view': 'org' };
    await roleRepo.save(r);
    await env.get('/patients', person).expect(200);
    r.permissions = {};
    await roleRepo.save(r);
    await env.get('/patients', person).expect(403);
    const me = dataOf<MeAccess>(await env.get('/me/access', person).expect(200));
    expect(me.permissions).toEqual({});
  });
});
