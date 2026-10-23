import { randomUUID } from 'crypto';
import { AuditLog } from 'src/common/audit/entities/audit-log.entity';
import { bootApp, dataOf, Env, errorOf, note, Person, seedWorld } from './harness';

interface Theme {
  app_name: string;
  logo_url: string | null;
  brand_color: string;
  sidebar_style: string;
  default_mode: string;
  [k: string]: unknown;
}

/** First value stored under `key` anywhere in a nested JSON value. */
function findKey(v: unknown, key: string): unknown {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (key in o) return o[key];
  for (const x of Object.values(o)) {
    const hit = findKey(x, key);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** Section 8 — Theme & settings registry (AC-THEME). THEME-09..13 / 15 are UNIT / UI cases. */
describe('AC-THEME theme & settings registry (API)', () => {
  let env: Env;
  let w: Env['world'];
  const sa = () => env.call;

  const saPut = (body: object) =>
    env.call('put', '/platform/theme', w.people.SA, { body, org: null, loc: null });
  const ownerPut = (body: object) => env.put('/admin/theme', w.people.OwnerA, body);
  const theme = async (who: Person = w.people.OwnerA, loc = who.locId) =>
    dataOf<Theme>(await env.get('/theme', who, { loc }).expect(200));
  const resetPlatform = () =>
    saPut({
      values: {
        app_name: null,
        logo_url: null,
        brand_color: null,
        sidebar_style: null,
        default_mode: null,
      },
      locks: { brand_color: false, app_name: false },
    });
  const resetOrg = () =>
    ownerPut({
      values: {
        app_name: null,
        logo_url: null,
        brand_color: null,
        sidebar_style: null,
        default_mode: null,
      },
      locks: { brand_color: false, app_name: false },
    });

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'theme');
    await resetPlatform().expect(200);
  }, 900_000);
  afterAll(async () => {
    try {
      await resetPlatform();
    } finally {
      await env?.close();
    }
  });

  it('THEME-01 cascade: location → org → platform → code default', async () => {
    void sa;
    const owner = w.people.OwnerA;
    expect((await theme(owner, w.L1)).app_name).toBe('MedTrackr'); // code default
    await saPut({ values: { app_name: 'Platform Co' } }).expect(200);
    expect((await theme(owner, w.L1)).app_name).toBe('Platform Co');
    await ownerPut({ values: { app_name: 'Org Co' } }).expect(200);
    expect((await theme(owner, w.L1)).app_name).toBe('Org Co');
    await env
      .put(`/admin/theme/location/${w.L2}`, owner, { values: { app_name: 'Branch Co' } })
      .expect(200);
    expect((await theme(owner, w.L2)).app_name).toBe('Branch Co');
    expect((await theme(owner, w.L1)).app_name).toBe('Org Co');
    // Clearing falls back one level at a time.
    await env
      .put(`/admin/theme/location/${w.L2}`, owner, { values: { app_name: null } })
      .expect(200);
    expect((await theme(owner, w.L2)).app_name).toBe('Org Co');
    await ownerPut({ values: { app_name: null } }).expect(200);
    expect((await theme(owner, w.L2)).app_name).toBe('Platform Co');
    await saPut({ values: { app_name: null } }).expect(200);
    expect((await theme(owner, w.L2)).app_name).toBe('MedTrackr');
  });

  it('THEME-02 lock: platform lock beats an owner write', async () => {
    await saPut({
      values: { brand_color: '#112233' },
      locks: { brand_color: true },
    }).expect(200);
    const res = await ownerPut({ values: { brand_color: '#445566' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect((await theme()).brand_color).toBe('#112233');
    await saPut({ values: { brand_color: null }, locks: { brand_color: false } }).expect(200);
    await resetOrg();
  });

  it('THEME-03 validation: invalid hex, unknown sidebar_style, non-URL logo → 400', async () => {
    await ownerPut({ values: { brand_color: 'blue' } }).expect(400);
    await ownerPut({ values: { brand_color: '#12' } }).expect(400);
    await ownerPut({ values: { sidebar_style: 'neon' } }).expect(400);
    await ownerPut({ values: { logo_url: 'not a url' } }).expect(400);
    await ownerPut({ values: { default_mode: 'purple' } }).expect(400);
  });

  it('THEME-04 public theme: no auth, theme.* tokens only', async () => {
    await ownerPut({ values: { app_name: 'Public Clinic', brand_color: '#0d9488' } }).expect(200);
    const res = await env.call('get', `/public/theme/${w.orgA}`, null, { org: null, loc: null }).expect(200);
    const t = dataOf<Record<string, unknown>>(res);
    expect(Object.keys(t).sort()).toEqual(
      [
        'app_name',
        'brand_color',
        'default_mode',
        'favicon_url',
        'logo_dark_url',
        'logo_url',
        'sidebar_style',
      ].sort(),
    );
    expect(t.app_name).toBe('Public Clinic');
    expect(t.brand_color).toBe('#0d9488');
    // Nothing else about the org leaks.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(w.orgA);
    expect(body).not.toContain('slug');
    await resetOrg();
  });

  it('THEME-05 public theme for an unknown org → defaults, never a 500', async () => {
    const res = await env.call('get', `/public/theme/${randomUUID()}`, null, { org: null, loc: null });
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(dataOf<Theme>(res).app_name).toBeTruthy();
    }
    const bad = await env.call('get', '/public/theme/not-a-uuid', null, { org: null, loc: null });
    expect(bad.status).toBeLessThan(500);
  });

  it('THEME-06 audit + version: owner save writes audit_logs and bumps config_values.version', async () => {
    const audits = () =>
      env.ds.getRepository(AuditLog).count({ where: { organizationId: w.orgA } });
    const a0 = await audits();
    await ownerPut({ values: { brand_color: '#123456' } }).expect(200);
    const row = async () =>
      (
        await env.ds.query<{ version: number }[]>(
          `SELECT version FROM config_values WHERE scope_type = 'org' AND scope_id = $1 AND key = 'theme.brand_color'`,
          [w.orgA],
        )
      )[0].version;
    const v1 = await row();
    await ownerPut({ values: { brand_color: '#654321' } }).expect(200);
    expect(await row()).toBe(v1 + 1);
    expect(await audits()).toBeGreaterThanOrEqual(a0 + 2);
    await resetOrg();
  });

  it('THEME-07 location override: L2 sees its own name + logo, L1 the org one', async () => {
    const owner = w.people.OwnerA;
    await ownerPut({ values: { app_name: 'Org Name', logo_url: 'https://cdn.example.com/org.png' } }).expect(200);
    await env
      .put(`/admin/theme/location/${w.L2}`, owner, {
        values: { app_name: 'L2 Name', logo_url: 'https://cdn.example.com/l2.png' },
      })
      .expect(200);
    const l2 = await theme(owner, w.L2);
    const l1 = await theme(owner, w.L1);
    expect(l2.app_name).toBe('L2 Name');
    expect(l2.logo_url).toBe('https://cdn.example.com/l2.png');
    expect(l1.app_name).toBe('Org Name');
    expect(l1.logo_url).toBe('https://cdn.example.com/org.png');
    // A staff member at L2 (MultiU is a doctor there) gets the same.
    const staffL2 = await theme(w.multiAtL2, w.L2);
    expect(staffL2.app_name).toBe('L2 Name');
    await env.put(`/admin/theme/location/${w.L2}`, owner, { values: { app_name: null, logo_url: null } }).expect(200);
    await resetOrg();
  });

  it('THEME-08 platform endpoints: OwnerA 403, SA 200', async () => {
    const owner = await env.call('put', '/platform/theme', w.people.OwnerA, {
      body: { values: { app_name: 'Owner tries platform' } },
    });
    expect(owner.status).toBe(403);
    await env.call('get', '/platform/theme', w.people.OwnerA).expect(403);
    await saPut({ values: { app_name: 'SA Platform' } }).expect(200);
    await saPut({ values: { app_name: null } }).expect(200);
  });

  it('THEME-14 print logo: theme logo wins, falls back to the old location logo', async () => {
    const owner = w.people.OwnerA;
    await env.patch('/billing/settings', owner, { showLogo: true }).expect(200);
    await env
      .patch(`/locations/${w.L1}/settings`, owner, { logoUrl: 'https://cdn.example.com/old-location.png' }, { org: null, loc: null })
      .expect(200);
    const invoiceId = randomUUID();
    await env.ds.query(
      `INSERT INTO invoices (id, organization_id, location_id, patient_id, invoice_number, issue_date, issued_at, due_date, issued_by)
       VALUES ($1,$2,$3,$4,$5, CURRENT_DATE, now(), CURRENT_DATE, $6)`,
      [invoiceId, w.orgA, w.L1, w.patients.P1, `THM-${randomUUID().slice(0, 6)}`, owner.userId],
    );
    const logo = async () =>
      findKey(dataOf(await env.get(`/print/invoices/${invoiceId}`, owner).expect(200)), 'logoUrl');

    await ownerPut({ values: { logo_url: 'https://cdn.example.com/theme.png' } }).expect(200);
    expect(await logo()).toBe('https://cdn.example.com/theme.png');
    await ownerPut({ values: { logo_url: null } }).expect(200);
    expect(await logo()).toBe('https://cdn.example.com/old-location.png');
    note('THEME-14', 'print header read from GET /print/invoices/:id');
  });
});
