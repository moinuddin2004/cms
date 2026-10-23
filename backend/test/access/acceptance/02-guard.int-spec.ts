import { bootApp, dataOf, Env, errorOf, seedWorld } from './harness';

/** Section 2 — Guard & decorators (AC-GRD). GRD-03 / GRD-06 are unit tests in src/access/acceptance. */
describe('AC-GRD guard', () => {
  let env: Env;
  let w: Env['world'];

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'grd');
  }, 900_000);
  afterAll(async () => env?.close());

  it('GRD-01 @Can allows: RecU creates a patient → 201', async () => {
    const res = await env
      .post('/patients', w.people.RecU, {
        fullName: 'Guard Test Patient',
        phone: '03001234567',
      })
      .expect(201);
    expect(dataOf<{ id: string }>(res).id).toBeDefined();
  });

  it('GRD-02 @Can denies with a structured body', async () => {
    const res = await env
      .post('/payroll/generate', w.people.AsstU, {})
      .expect(403);
    const err = errorOf(res);
    expect(err.code).toBe('NO_PERMISSION');
    expect(err.missing).toContain('payroll.manage');
  });

  it('GRD-04 @AnyMember: member with no permissions → 200; non-member → 403', async () => {
    await env.get('/lab-links', w.people.NoRoleU).expect(200);
    await env.get('/lab-links', w.people.Outsider, { org: w.orgA }).expect(403);
  });

  it('GRD-05 @VisibleIf / price strip: absent for Doc1, present for RecU', async () => {
    await env
      .post('/plan-templates', w.people.AdminU, {
        name: 'Root canal',
        items: [
          { procedureName: 'RCT', estimatedSessions: 2, estimatedCost: 12000 },
        ],
      })
      .expect(201);
    const asDoc = dataOf<{ items: Record<string, unknown>[] }[]>(
      await env.get('/plan-templates', w.people.Doc1).expect(200),
    );
    const asRec = dataOf<{ items: Record<string, unknown>[] }[]>(
      await env.get('/plan-templates', w.people.RecU).expect(200),
    );
    expect(asDoc.length).toBeGreaterThan(0);
    for (const t of asDoc)
      for (const i of t.items) expect(i.estimatedCost).toBeUndefined();
    expect(asRec[0].items[0].estimatedCost).toBe(12000);
  });

  it('GRD-07 owner bypass: five @Can endpoints across modules', async () => {
    const owner = w.people.OwnerA;
    const urls = [
      '/patients',
      '/inventory/items',
      '/employees',
      '/admin/roles',
      '/lab-billing/invoices',
    ];
    const statuses: Record<string, number> = {};
    for (const u of urls) statuses[u] = (await env.get(u, owner)).status;
    const forbidden = Object.entries(statuses).filter(
      ([, s]) => s === 401 || s === 403,
    );
    expect(forbidden).toEqual([]);
    // …and a non-owner with an empty role is refused on the same routes.
    expect((await env.get('/patients', w.people.NoRoleU)).status).toBe(403);
  });
});
