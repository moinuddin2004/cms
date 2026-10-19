/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import type { Response } from 'supertest';
import { StatusHistory } from 'src/common/audit/entities/status-history.entity';
import { Location } from 'src/locations/entities/location.entity';
import { findLabMemberships } from 'src/labs/portal/lab-memberships';
import { LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

type Method = 'get' | 'post' | 'patch';

/** Lab ERD §7 / §13: the lab portal route group and its isolation rules. */
describe('Lab portal (API)', () => {
  let fx: LabsFixture;
  let labA: { id: string; version: number };
  let labB: { id: string; version: number };
  let adminA: { id: string; email: string };
  let techA: { id: string; email: string };
  let adminB: { id: string; email: string };
  let both: { id: string; email: string };

  /** Portal route as `as`, optionally choosing the lab with `x-lab-id`. */
  const portal = (
    method: Method,
    url: string,
    as: string,
    labId?: string,
    body?: object,
  ) => {
    let req = request(fx.app.getHttpServer())
      [method](url)
      .set('x-test-user', as);
    if (labId) req = req.set('x-lab-id', labId);
    return req.send(body);
  };

  const createLab = async (name: string) => {
    const res = await fx.platform('post', '/platform/labs', fx.superAdmin, {
      name: `${name} ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Karachi',
    });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; version: number };
  };

  const addMember = async (
    labId: string,
    email: string,
    role: 'lab_admin' | 'lab_technician',
  ) => {
    const res = await fx.platform(
      'post',
      `/platform/labs/${labId}/members`,
      fx.superAdmin,
      { email, role },
    );
    expect(res.status).toBe(201);
    return res.body.data as { id: string; version: number };
  };

  /** clinic adds the lab (invited) → returns the link id. */
  const invite = async (
    clinic: LabsFixture['clinicA'],
    labId: string,
    body: object = {},
  ) => {
    const res = await fx.clinic('post', '/lab-links', clinic, clinic.admin, {
      labId,
      ...body,
    });
    expect(res.status).toBe(201);
    return res.body.data as { id: string; version: number };
  };

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_portal_api');
    labA = await createLab('Portal Lab A');
    labB = await createLab('Portal Lab B');
    adminA = await fx.newUser('lab-admin-a');
    techA = await fx.newUser('lab-tech-a');
    adminB = await fx.newUser('lab-admin-b');
    both = await fx.newUser('lab-both');
    await addMember(labA.id, adminA.email, 'lab_admin');
    await addMember(labA.id, techA.email, 'lab_technician');
    await addMember(labB.id, adminB.email, 'lab_admin');
    await addMember(labA.id, both.email, 'lab_technician');
    await addMember(labB.id, both.email, 'lab_technician');

    await fx.dataSource
      .getRepository(Location)
      .update({ id: fx.clinicA.locationId }, { city: 'Lahore' });
    await invite(fx.clinicA, labA.id, {
      paymentTermsDays: 45,
      notes: 'Clinic-internal note: negotiate prices',
    });
    await invite(fx.clinicB, labB.id);
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('access', () => {
    it('refuses users who are not lab members (clinic staff, super admin)', async () => {
      for (const as of [fx.clinicA.admin, fx.clinicA.doctor, fx.superAdmin]) {
        const me = await portal('get', '/lab-portal/me', as);
        expect(me.status).toBe(403);
        expect(code(me)).toBe('LAB_ACCESS_DENIED');
        const lab = await portal('get', '/lab-portal/lab', as, labA.id);
        expect(lab.status).toBe(403);
      }
    });

    it('rejects clinic tenant headers on portal routes', async () => {
      const res = await request(fx.app.getHttpServer())
        .get('/lab-portal/lab')
        .set('x-test-user', adminA.id)
        .set('x-organization-id', fx.clinicA.organizationId)
        .set('x-location-id', fx.clinicA.locationId);
      expect(res.status).toBe(400);
      expect(code(res)).toBe('LAB_PORTAL_CLINIC_CONTEXT');
    });

    it('keeps lab users out of clinic routes', async () => {
      const withHeaders = await fx.clinic(
        'get',
        '/lab-links',
        fx.clinicA,
        adminA.id,
      );
      expect(withHeaders.status).toBe(403);

      const noHeaders = await fx.platform('get', '/lab-links', adminA.id);
      expect(noHeaders.status).toBe(400);

      const platform = await fx.platform('get', '/platform/labs', adminA.id);
      expect(platform.status).toBe(403);
    });

    it('resolves a single membership without x-lab-id', async () => {
      const res = await portal('get', '/lab-portal/lab', adminA.id);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: labA.id, city: 'Karachi' });
    });

    it('lab A member cannot read lab B', async () => {
      const other = await portal('get', '/lab-portal/lab', adminA.id, labB.id);
      expect(other.status).toBe(403);
      expect(code(other)).toBe('LAB_ACCESS_DENIED');

      // a lab that doesn't exist / garbage looks the same
      for (const id of [randomUUID(), 'not-a-uuid']) {
        const res = await portal('get', '/lab-portal/lab', adminA.id, id);
        expect(res.status).toBe(403);
      }

      const clinics = await portal('get', '/lab-portal/clinics', adminB.id);
      expect(
        clinics.body.data.map((c: { clinic: { name: string } }) => c.clinic),
      ).toEqual([{ name: 'Labs IT B', city: null }]);
    });

    it('needs x-lab-id when the user works in several labs', async () => {
      const me = await portal('get', '/lab-portal/me', both.id);
      expect(me.status).toBe(200);
      expect(
        me.body.data.labs.map((l: { labId: string }) => l.labId).sort(),
      ).toEqual([labA.id, labB.id].sort());

      const none = await portal('get', '/lab-portal/lab', both.id);
      expect(none.status).toBe(400);
      expect(code(none)).toBe('LAB_SELECTION_REQUIRED');

      const b = await portal('get', '/lab-portal/lab', both.id, labB.id);
      expect(b.status).toBe(200);
      expect(b.body.data.id).toBe(labB.id);
    });

    it('enforces lab roles', async () => {
      const read = await portal('get', '/lab-portal/clinics', techA.id);
      expect(read.status).toBe(200);
      for (const [method, url] of [
        ['get', '/lab-portal/members'],
        ['patch', '/lab-portal/lab'],
      ] as const) {
        const res = await portal(method, url, techA.id, undefined, {
          phone: '0300 7654321',
          version: 1,
        });
        expect(res.status).toBe(403);
      }
    });

    it('refuses members of a suspended lab and deactivated members', async () => {
      const lab = await createLab('Suspended Lab');
      const user = await fx.newUser('lab-suspended');
      await addMember(lab.id, user.email, 'lab_admin');
      expect((await portal('get', '/lab-portal/lab', user.id)).status).toBe(
        200,
      );
      const suspended = await fx.platform(
        'post',
        `/platform/labs/${lab.id}/status`,
        fx.superAdmin,
        { status: 'suspended', version: lab.version },
      );
      expect(suspended.status).toBe(201);
      expect((await portal('get', '/lab-portal/lab', user.id)).status).toBe(
        403,
      );
      expect(await findLabMemberships(fx.dataSource.manager, user.id)).toEqual(
        [],
      );
    });
  });

  describe('clinics', () => {
    it('lists linked clinics with name, city, status and terms only', async () => {
      const res = await portal('get', '/lab-portal/clinics', adminA.id);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      const [row] = res.body.data;
      expect(Object.keys(row).sort()).toEqual([
        'clinic',
        'id',
        'paymentTermsDays',
        'status',
        'version',
      ]);
      expect(row.clinic).toEqual({ name: 'Labs IT A', city: 'Lahore' });
      expect(row).toMatchObject({ status: 'invited', paymentTermsDays: 45 });

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(fx.clinicA.organizationId);
      expect(raw).not.toContain(fx.clinicA.locationId);
      expect(raw).not.toContain('negotiate');
      expect(raw).not.toContain('patientDataLevel');
    });

    it('accepts, suspends and reactivates from the lab side', async () => {
      const [link] = (await portal('get', '/lab-portal/clinics', adminA.id))
        .body.data;

      const tech = await portal(
        'post',
        `/lab-portal/clinics/${link.id}/transitions`,
        techA.id,
        undefined,
        { action: 'activate', version: link.version },
      );
      expect(tech.status).toBe(403);

      const accepted = await portal(
        'post',
        `/lab-portal/clinics/${link.id}/transitions`,
        adminA.id,
        undefined,
        { action: 'activate', version: link.version },
      );
      expect(accepted.status).toBe(201);
      expect(accepted.body.data.status).toBe('active');

      const history = await fx.dataSource
        .getRepository(StatusHistory)
        .findOneByOrFail({ entityId: link.id, actionCode: 'activate' });
      expect(history).toMatchObject({
        actorSide: 'lab',
        via: 'portal',
        actorUserId: adminA.id,
        organizationId: fx.clinicA.organizationId,
      });

      const suspended = await portal(
        'post',
        `/lab-portal/clinics/${link.id}/transitions`,
        adminA.id,
        undefined,
        {
          action: 'suspend',
          reason: 'Unpaid bills',
          version: accepted.body.data.version,
        },
      );
      expect(suspended.body.data.status).toBe('suspended');

      // The clinic can't lift the lab's suspension …
      const clinicSide = await fx.clinic(
        'post',
        `/lab-links/${link.id}/transitions`,
        fx.clinicA,
        fx.clinicA.admin,
        { action: 'reactivate', version: suspended.body.data.version },
      );
      expect(code(clinicSide)).toBe('LAB_LINK_SUSPENDED_BY_OTHER_SIDE');

      // … the lab can.
      const back = await portal(
        'post',
        `/lab-portal/clinics/${link.id}/transitions`,
        adminA.id,
        undefined,
        { action: 'reactivate', version: suspended.body.data.version },
      );
      expect(back.body.data.status).toBe('active');
    });

    it("cannot transition another lab's link", async () => {
      const [linkB] = (await portal('get', '/lab-portal/clinics', adminB.id))
        .body.data;
      const res = await portal(
        'post',
        `/lab-portal/clinics/${linkB.id}/transitions`,
        adminA.id,
        undefined,
        { action: 'activate', version: linkB.version },
      );
      expect(res.status).toBe(404);
      expect(code(res)).toBe('LAB_LINK_NOT_FOUND');
    });
  });

  describe('lab profile and team (lab admin)', () => {
    it('edits contact details only', async () => {
      const current = (await portal('get', '/lab-portal/lab', adminA.id)).body
        .data;
      const res = await portal(
        'patch',
        '/lab-portal/lab',
        adminA.id,
        undefined,
        {
          phone: '0300 1112223',
          address: 'Plot 4, Saddar',
          version: current.version,
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        phone: '0300 1112223',
        address: 'Plot 4, Saddar',
        version: current.version + 1,
      });

      for (const field of [{ name: 'Renamed' }, { status: 'suspended' }]) {
        const bad = await portal(
          'patch',
          '/lab-portal/lab',
          adminA.id,
          undefined,
          { ...field, version: current.version + 1 },
        );
        expect(bad.status).toBe(400);
      }
    });

    it("lists, adds and deactivates only its own lab's members", async () => {
      const list = await portal('get', '/lab-portal/members', adminA.id);
      expect(list.status).toBe(200);
      const ids = list.body.data.map(
        (m: { user: { id: string } }) => m.user.id,
      );
      expect(ids).toEqual(expect.arrayContaining([adminA.id, techA.id]));
      expect(ids).not.toContain(adminB.id);

      const newcomer = await fx.newUser('lab-newcomer');
      const added = await portal(
        'post',
        '/lab-portal/members',
        adminA.id,
        undefined,
        {
          email: newcomer.email,
          role: 'lab_technician',
        },
      );
      expect(added.status).toBe(201);
      expect((await portal('get', '/lab-portal/lab', newcomer.id)).status).toBe(
        200,
      );

      const off = await portal(
        'patch',
        `/lab-portal/members/${added.body.data.id}`,
        adminA.id,
        undefined,
        { isActive: false, version: added.body.data.version },
      );
      expect(off.status).toBe(200);
      expect(off.body.data.isActive).toBe(false);
      expect((await portal('get', '/lab-portal/lab', newcomer.id)).status).toBe(
        403,
      );

      // Clinic staff can't be pulled into an external lab.
      const clinicUser = await portal(
        'post',
        '/lab-portal/members',
        adminA.id,
        undefined,
        { email: await emailOf(fx.clinicA.doctor), role: 'lab_technician' },
      );
      expect(code(clinicUser)).toBe('LAB_MEMBER_NOT_ALLOWED');
    });

    it("cannot change itself or another lab's member", async () => {
      const list = (await portal('get', '/lab-portal/members', adminA.id)).body
        .data as Array<{ id: string; version: number; user: { id: string } }>;
      const self = list.find((m) => m.user.id === adminA.id)!;
      const res = await portal(
        'patch',
        `/lab-portal/members/${self.id}`,
        adminA.id,
        undefined,
        { isActive: false, version: self.version },
      );
      expect(res.status).toBe(409);
      expect(code(res)).toBe('LAB_MEMBER_SELF_CHANGE');

      const bMember = (
        await fx.platform(
          'get',
          `/platform/labs/${labB.id}/members`,
          fx.superAdmin,
        )
      ).body.data[0];
      const cross = await portal(
        'patch',
        `/lab-portal/members/${bMember.id}`,
        adminA.id,
        undefined,
        { isActive: false, version: bMember.version },
      );
      expect(cross.status).toBe(404);
    });
  });

  const emailOf = async (userId: string) =>
    (
      await fx.dataSource.query<Array<{ email: string }>>(
        'SELECT email FROM users WHERE uuid = $1',
        [userId],
      )
    )[0]?.email;
});
