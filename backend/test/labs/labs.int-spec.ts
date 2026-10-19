/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { randomUUID } from 'crypto';
import type { Response } from 'supertest';
import { AuditLog } from 'src/common/audit/entities/audit-log.entity';
import { StatusHistory } from 'src/common/audit/entities/status-history.entity';
import { LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

/** Lab ERD §19 acceptance + §10 invariants that Sprint 1 can already prove. */
describe('Labs integration — directory, members and clinic links (API)', () => {
  let fx: LabsFixture;

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_api');
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  const createLab = async (body: object = {}) => {
    const res = await fx.platform('post', '/platform/labs', fx.superAdmin, {
      name: `Smile Lab ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Karachi',
      phone: '0300 1234567',
      ...body,
    });
    expect(res.status).toBe(201);
    return res.body.data as {
      id: string;
      version: number;
      status: string;
      labType: string;
    };
  };

  describe('platform directory', () => {
    it('is super-admin only', async () => {
      const res = await fx.platform('get', '/platform/labs', fx.clinicA.admin);
      expect(res.status).toBe(403);
    });

    it('creates, lists and edits a lab with optimistic locking', async () => {
      const lab = await createLab({ name: 'Precision Dental Lab' });
      expect(lab.status).toBe('active');
      expect(lab.version).toBe(1);

      const list = await fx.platform(
        'get',
        '/platform/labs?search=precision&labType=external',
        fx.superAdmin,
      );
      expect(list.status).toBe(200);
      expect(list.body.data.data.map((l: { id: string }) => l.id)).toContain(
        lab.id,
      );

      const edited = await fx.platform(
        'patch',
        `/platform/labs/${lab.id}`,
        fx.superAdmin,
        { city: 'Lahore', version: 1 },
      );
      expect(edited.status).toBe(200);
      expect(edited.body.data).toMatchObject({ city: 'Lahore', version: 2 });

      const stale = await fx.platform(
        'patch',
        `/platform/labs/${lab.id}`,
        fx.superAdmin,
        { city: 'Quetta', version: 1 },
      );
      expect(stale.status).toBe(409);
      expect(code(stale)).toBe('STALE_VERSION');
    });

    it('validates type ↔ owner', async () => {
      const noOwner = await fx.platform(
        'post',
        '/platform/labs',
        fx.superAdmin,
        { name: 'X', labType: 'internal' },
      );
      expect(noOwner.status).toBe(400);

      const externalWithOwner = await fx.platform(
        'post',
        '/platform/labs',
        fx.superAdmin,
        {
          name: 'X',
          labType: 'external',
          ownerOrganizationId: fx.clinicA.organizationId,
        },
      );
      expect(code(externalWithOwner)).toBe('LAB_OWNER_INVALID');
    });

    it('audits only changed fields and skips no-op edits', async () => {
      const lab = await createLab({ city: 'Karachi' });
      await fx.platform('patch', `/platform/labs/${lab.id}`, fx.superAdmin, {
        city: 'Karachi',
        version: 1,
      });
      const noop = await fx.dataSource
        .getRepository(AuditLog)
        .countBy({ entityId: lab.id });
      expect(noop).toBe(1); // only "create"

      await fx.platform('patch', `/platform/labs/${lab.id}`, fx.superAdmin, {
        city: 'Hyderabad',
        email: 'lab@example.com',
        version: 1,
      });
      const update = await fx.dataSource
        .getRepository(AuditLog)
        .findOneByOrFail({ entityId: lab.id, action: 'update' as never });
      expect(update.changes).toEqual({
        before: { city: 'Karachi', email: null },
        after: { city: 'Hyderabad', email: 'lab@example.com' },
      });
      expect(update.actorSide).toBe('platform');
      expect(update.actorUserId).toBe(fx.superAdmin);

      const history = await fx.platform(
        'get',
        `/platform/labs/${lab.id}/history`,
        fx.superAdmin,
      );
      expect(
        history.body.data.map((h: { action: string }) => h.action),
      ).toEqual(['update', 'create']);
    });

    it('issues time-ordered UUIDv7 ids', async () => {
      const a = await createLab();
      const b = await createLab();
      expect(a.id[14]).toBe('7');
      expect(b.id[14]).toBe('7');
      expect(a.id < b.id).toBe(true);
    });
  });

  describe('internal labs', () => {
    it('are linked to their owner and invisible to other clinics', async () => {
      const lab = await createLab({
        name: `In-house ${randomUUID().slice(0, 6)}`,
        labType: 'internal',
        ownerOrganizationId: fx.clinicA.organizationId,
      });

      const ownList = await fx.clinic(
        'get',
        '/lab-links',
        fx.clinicA,
        fx.clinicA.admin,
      );
      const own = ownList.body.data.data.find(
        (l: { lab: { id: string } }) => l.lab.id === lab.id,
      );
      expect(own).toMatchObject({ status: 'active' });
      expect(own.activatedAt).not.toBeNull();

      const dirB = await fx.clinic(
        'get',
        '/lab-links/directory',
        fx.clinicB,
        fx.clinicB.admin,
      );
      expect(dirB.body.data.map((l: { id: string }) => l.id)).not.toContain(
        lab.id,
      );

      const linkB = await fx.clinic(
        'post',
        '/lab-links',
        fx.clinicB,
        fx.clinicB.admin,
        { labId: lab.id },
      );
      expect(linkB.status).toBe(404);
    });
  });

  describe('clinic lab list', () => {
    it('invites, activates, suspends and reactivates with full history', async () => {
      const lab = await createLab();
      const A = fx.clinicA;

      const dir = await fx.clinic(
        'get',
        `/lab-links/directory?search=${encodeURIComponent('Smile Lab')}`,
        A,
        A.admin,
      );
      expect(
        dir.body.data.find((l: { id: string }) => l.id === lab.id),
      ).toMatchObject({ link: null });

      const created = await fx.clinic('post', '/lab-links', A, A.admin, {
        labId: lab.id,
        paymentTermsDays: 15,
        patientDataLevel: 'code_only',
      });
      expect(created.status).toBe(201);
      const link = created.body.data;
      expect(link).toMatchObject({
        status: 'invited',
        paymentTermsDays: 15,
        patientDataLevel: 'code_only',
        activatedAt: null,
        version: 1,
      });

      const dup = await fx.clinic('post', '/lab-links', A, A.admin, {
        labId: lab.id,
      });
      expect(code(dup)).toBe('LAB_LINK_EXISTS');

      const go = (action: string, version: number, reason?: string) =>
        fx.clinic('post', `/lab-links/${link.id}/transitions`, A, A.admin, {
          action,
          version,
          reason,
        });

      const activated = await go('activate', 1);
      expect(activated.body.data).toMatchObject({
        status: 'active',
        version: 2,
      });
      const firstActivation = activated.body.data.activatedAt;
      expect(firstActivation).not.toBeNull();

      expect(code(await go('activate', 2))).toBe('INVALID_TRANSITION');
      expect(code(await go('suspend', 2))).toBe('LAB_LINK_REASON_REQUIRED');
      expect(code(await go('suspend', 1, 'late'))).toBe('STALE_VERSION');

      const suspended = await go('suspend', 2, 'Repeated late deliveries');
      expect(suspended.body.data.status).toBe('suspended');

      const back = await go('reactivate', 3);
      expect(back.body.data).toMatchObject({
        status: 'active',
        activatedAt: firstActivation,
      });

      const states = await fx.dataSource.getRepository(StatusHistory).find({
        where: { entityId: link.id },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      expect(states.map((s) => [s.fromState, s.toState, s.actionCode])).toEqual(
        [
          [null, 'invited', 'invite'],
          ['invited', 'active', 'activate'],
          ['active', 'suspended', 'suspend'],
          ['suspended', 'active', 'reactivate'],
        ],
      );
      expect(states[2].reason).toBe('Repeated late deliveries');
      expect(states.every((s) => s.organizationId === A.organizationId)).toBe(
        true,
      );

      const history = await fx.clinic(
        'get',
        `/lab-links/${link.id}/history`,
        A,
        A.admin,
      );
      expect(history.status).toBe(200);
      expect(history.body.data.length).toBeGreaterThanOrEqual(8);
    });

    it('edits terms with optimistic locking', async () => {
      const lab = await createLab();
      const A = fx.clinicA;
      const link = (
        await fx.clinic('post', '/lab-links', A, A.admin, { labId: lab.id })
      ).body.data;

      const ok = await fx.clinic('patch', `/lab-links/${link.id}`, A, A.admin, {
        paymentTermsDays: 45,
        notes: 'Pickup Tuesdays',
        version: 1,
      });
      expect(ok.body.data).toMatchObject({
        paymentTermsDays: 45,
        notes: 'Pickup Tuesdays',
        version: 2,
      });

      const tooLong = await fx.clinic(
        'patch',
        `/lab-links/${link.id}`,
        A,
        A.admin,
        { paymentTermsDays: 400, version: 2 },
      );
      expect(tooLong.status).toBe(400);
    });

    it('a suspended lab cannot be added or activated', async () => {
      const lab = await createLab();
      const A = fx.clinicA;
      const link = (
        await fx.clinic('post', '/lab-links', A, A.admin, { labId: lab.id })
      ).body.data;
      await fx.platform(
        'post',
        `/platform/labs/${lab.id}/status`,
        fx.superAdmin,
        {
          status: 'suspended',
          version: 1,
        },
      );

      const activate = await fx.clinic(
        'post',
        `/lab-links/${link.id}/transitions`,
        A,
        A.admin,
        { action: 'activate', version: 1 },
      );
      expect(code(activate)).toBe('LAB_SUSPENDED');

      const addB = await fx.clinic(
        'post',
        '/lab-links',
        fx.clinicB,
        fx.clinicB.admin,
        { labId: lab.id },
      );
      expect(code(addB)).toBe('LAB_SUSPENDED');
    });
  });

  describe('roles and tenant isolation', () => {
    let linkA: { id: string; version: number };

    beforeAll(async () => {
      const lab = await createLab();
      linkA = (
        await fx.clinic('post', '/lab-links', fx.clinicA, fx.clinicA.admin, {
          labId: lab.id,
        })
      ).body.data;
    });

    it('doctors can read the lab list but not change it', async () => {
      const A = fx.clinicA;
      expect((await fx.clinic('get', '/lab-links', A, A.doctor)).status).toBe(
        200,
      );
      expect(
        (await fx.clinic('get', `/lab-links/${linkA.id}`, A, A.doctor)).status,
      ).toBe(200);
      for (const [method, url, body] of [
        ['get', '/lab-links/directory'],
        ['get', `/lab-links/${linkA.id}/history`],
        ['post', '/lab-links', { labId: randomUUID() }],
        ['patch', `/lab-links/${linkA.id}`, { version: 1 }],
        [
          'post',
          `/lab-links/${linkA.id}/transitions`,
          { action: 'activate', version: 1 },
        ],
      ] as const) {
        const res = await fx.clinic(method, url, A, A.doctor, body);
        expect([method, url, res.status]).toEqual([method, url, 403]);
      }
    });

    it("another clinic's link answers 404 everywhere", async () => {
      const B = fx.clinicB;
      for (const [method, url, body] of [
        ['get', `/lab-links/${linkA.id}`],
        ['get', `/lab-links/${linkA.id}/history`],
        [
          'patch',
          `/lab-links/${linkA.id}`,
          { paymentTermsDays: 1, version: 1 },
        ],
        [
          'post',
          `/lab-links/${linkA.id}/transitions`,
          { action: 'activate', version: 1 },
        ],
      ] as const) {
        const res = await fx.clinic(method, url, B, B.admin, body);
        expect([method, url, res.status]).toEqual([method, url, 404]);
      }
      const listB = await fx.clinic('get', '/lab-links', B, B.admin);
      expect(
        listB.body.data.data.map((l: { id: string }) => l.id),
      ).not.toContain(linkA.id);
    });

    it('tenant headers of a clinic the user does not belong to are refused', async () => {
      const res = await fx.clinic(
        'get',
        '/lab-links',
        fx.clinicB,
        fx.clinicA.admin,
      );
      expect(res.status).toBe(403);
    });

    it('the module is off until the clinic enables it', async () => {
      const off = fx.clinicOff;
      expect(
        (await fx.clinic('get', '/lab-links', off, off.admin)).status,
      ).toBe(403);
    });
  });

  describe('lab members', () => {
    it('adds lab staff, rejects clinic staff and duplicates, deactivates', async () => {
      const lab = await createLab();
      const url = `/platform/labs/${lab.id}/members`;
      const tech = await fx.newUser('tech');

      const added = await fx.platform('post', url, fx.superAdmin, {
        email: tech.email.toUpperCase(),
        role: 'lab_technician',
      });
      expect(added.status).toBe(201);
      expect(added.body.data).toMatchObject({
        role: 'lab_technician',
        isActive: true,
        user: { id: tech.id },
      });

      const dup = await fx.platform('post', url, fx.superAdmin, {
        email: tech.email,
        role: 'lab_admin',
      });
      expect(code(dup)).toBe('LAB_MEMBER_EXISTS');

      const clinicDoctor = await fx.dataSource.query(
        `SELECT email FROM users WHERE uuid = $1`,
        [fx.clinicA.doctor],
      );
      const notAllowed = await fx.platform('post', url, fx.superAdmin, {
        email: clinicDoctor[0].email,
        role: 'lab_admin',
      });
      expect(code(notAllowed)).toBe('LAB_MEMBER_NOT_ALLOWED');

      const unknown = await fx.platform('post', url, fx.superAdmin, {
        email: 'nobody@labs-it.test',
        role: 'lab_admin',
      });
      expect(code(unknown)).toBe('LAB_MEMBER_USER_NOT_FOUND');

      const off = await fx.platform(
        'patch',
        `${url}/${added.body.data.id}`,
        fx.superAdmin,
        { isActive: false, version: 1 },
      );
      expect(off.body.data).toMatchObject({ isActive: false, version: 2 });

      const lab2 = (
        await fx.platform('get', `/platform/labs/${lab.id}`, fx.superAdmin)
      ).body.data;
      expect(lab2.memberCount).toBe(0);
    });

    it("an internal lab may employ its owner's staff only", async () => {
      const lab = await createLab({
        labType: 'internal',
        ownerOrganizationId: fx.clinicA.organizationId,
      });
      const email = async (id: string) =>
        (
          await fx.dataSource.query(`SELECT email FROM users WHERE uuid = $1`, [
            id,
          ])
        )[0].email as string;
      const url = `/platform/labs/${lab.id}/members`;

      const own = await fx.platform('post', url, fx.superAdmin, {
        email: await email(fx.clinicA.doctor),
        role: 'lab_admin',
      });
      expect(own.status).toBe(201);

      const foreign = await fx.platform('post', url, fx.superAdmin, {
        email: await email(fx.clinicB.doctor),
        role: 'lab_admin',
      });
      expect(code(foreign)).toBe('LAB_MEMBER_NOT_ALLOWED');
    });
  });
});
