import { randomUUID } from 'crypto';
import * as request from 'supertest';
import {
  TEST_USER_HEADER,
  TenancyClinic,
  TenancyFixture,
  createTenancyFixture,
} from './tenancy-it.harness';

type Method = 'get' | 'post' | 'patch' | 'delete';

/**
 * TenantContextGuard used to skip every path starting with '/organizations'
 * or '/locations' before it read @RequireSuperAdmin(), so any signed-in user
 * could list, edit and deactivate organizations.
 */
describe('Super-admin and context-free routes (API)', () => {
  let fx: TenancyFixture;

  beforeAll(async () => {
    fx = await createTenancyFixture();
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  const call = (
    method: Method,
    url: string,
    userId: string,
    tenantFrom?: TenancyClinic,
    body?: object,
  ) => {
    let req = request(fx.app.getHttpServer())
      [method](url)
      .set(TEST_USER_HEADER, userId);
    if (tenantFrom) {
      req = req
        .set('x-organization-id', tenantFrom.tenant.organizationId)
        .set('x-location-id', tenantFrom.tenant.locationId);
    }
    return body ? req.send(body) : req;
  };

  /** Status per route, so a failure names the route that leaked. */
  const statuses = async (
    routes: Array<[Method, string, object?]>,
    userId: string,
    tenantFrom?: TenancyClinic,
  ) => {
    const out: Record<string, number> = {};
    for (const [method, url, body] of routes) {
      const res = await call(method, url, userId, tenantFrom, body);
      out[`${method.toUpperCase()} ${url}`] = res.status;
    }
    return out;
  };

  const superAdminRoutes = (): Array<[Method, string, object?]> => {
    const orgA = fx.clinicA.tenant.organizationId;
    return [
      ['get', '/organizations'],
      [
        'post',
        '/organizations',
        { name: 'Hijack', slug: `hijack-${randomUUID().slice(0, 8)}` },
      ],
      ['get', `/organizations/${orgA}`],
      ['patch', `/organizations/${orgA}`, { name: 'Hijacked' }],
      ['delete', `/organizations/${orgA}`],
      ['patch', `/organizations/${orgA}/settings`, { defaultSlotDuration: 5 }],
    ];
  };

  const all403 = (routes: Array<[Method, string, object?]>) =>
    Object.fromEntries(
      routes.map(([m, url]) => [`${m.toUpperCase()} ${url}`, 403]),
    );

  it('a normal clinic user gets 403 on every super-admin organizations route', async () => {
    const routes = superAdminRoutes();
    const A = fx.clinicA;
    expect(await statuses(routes, A.staffUserId, A)).toEqual(all403(routes));
  });

  it('an organization owner gets 403 on the super-admin organizations routes too', async () => {
    const routes = superAdminRoutes();
    expect(await statuses(routes, fx.clinicA.ownerUserId)).toEqual(
      all403(routes),
    );
  });

  it('a super admin gets 200 on the organizations routes', async () => {
    const orgA = fx.clinicA.tenant.organizationId;
    const list = await call('get', '/organizations', fx.superAdminId);
    expect(list.status).toBe(200);
    const ids = (list.body.data as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining([orgA]));

    expect(
      await statuses(
        [
          ['get', `/organizations/${orgA}`],
          ['get', `/organizations/${orgA}/settings`],
          ['patch', `/organizations/${orgA}`, { name: 'Tenancy IT A' }],
        ],
        fx.superAdminId,
      ),
    ).toEqual({
      [`GET /organizations/${orgA}`]: 200,
      [`GET /organizations/${orgA}/settings`]: 200,
      [`PATCH /organizations/${orgA}`]: 200,
    });
  });

  it("org settings are readable by that org's owner only (location settings page)", async () => {
    const orgA = fx.clinicA.tenant.organizationId;
    const orgB = fx.clinicB.tenant.organizationId;
    const owner = fx.clinicA.ownerUserId;

    expect(
      (await call('get', `/organizations/${orgA}/settings`, owner)).status,
    ).toBe(200);
    expect(
      (await call('get', `/organizations/${orgB}/settings`, owner)).status,
    ).toBe(403);
    expect(
      (
        await call(
          'get',
          `/organizations/${orgA}/settings`,
          fx.clinicA.staffUserId,
          fx.clinicA,
        )
      ).status,
    ).toBe(403);
  });

  it('locations stay context-free for owners and scoped to their own org', async () => {
    const owner = fx.clinicA.ownerUserId;
    const list = await call('get', '/locations', owner);
    expect(list.status).toBe(200);
    const orgIds = new Set(
      (list.body.data as Array<{ organizationId: string }>).map(
        (l) => l.organizationId,
      ),
    );
    expect([...orgIds]).toEqual([fx.clinicA.tenant.organizationId]);

    const locB = fx.clinicB.tenant.locationId;
    expect((await call('get', `/locations/${locB}`, owner)).status).toBe(403);
    // A non-owner employee is refused by the controller's own ownership check.
    expect(
      (await call('get', '/locations', fx.clinicA.staffUserId, fx.clinicA))
        .status,
    ).toBe(403);
  });
});
