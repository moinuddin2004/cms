import { AuditLog } from 'src/common/audit/entities/audit-log.entity';
import type { MeAccess } from 'src/access/access.controller';
import { bootApp, dataOf, Env, note, seedWorld } from './harness';

/** Section 7 — Sidebar layouts (AC-NAV): the API cases NAV-04 … NAV-07. UI cases live in vitest. */
describe('AC-NAV nav layouts (API)', () => {
  let env: Env;
  let w: Env['world'];

  const LAYOUT = {
    sections: [
      // reordered: Front desk first, dashboard last
      {
        label: 'Front desk',
        items: [
          { key: 'nav.billing.desk', label: 'Cash counter' },
          { key: 'nav.patients' },
        ],
      },
      { items: [{ key: 'nav.dashboard' }] },
    ],
    hidden: ['nav.payroll'],
  };
  const put = (body: object) => env.put('/admin/navigation', w.people.OwnerA, body);
  const auditRows = () =>
    env.ds.getRepository(AuditLog).count({
      where: { organizationId: w.orgA, entityType: 'nav_layout' },
    });
  const nav = async () =>
    dataOf<MeAccess>(await env.get('/me/access', w.people.RecU).expect(200)).nav;

  beforeAll(async () => {
    env = await bootApp();
    w = await seedWorld(env, 'nav');
  }, 900_000);
  afterAll(async () => env?.close());

  it('NAV-04 save layout: 200, /me/access.nav returns it, audit row, version +1', async () => {
    const v0 = await env.version();
    const a0 = await auditRows();
    await put(LAYOUT).expect(200);
    expect(await env.version()).toBe(v0 + 1);
    expect(await auditRows()).toBe(a0 + 1);
    expect(await nav()).toEqual(LAYOUT);
  });

  it('NAV-05 layout validation: each bad layout → 400', async () => {
    const bad: [string, object][] = [
      ['bad key', { sections: [{ items: [{ key: 'foo' }] }] }],
      [
        'duplicate key',
        {
          sections: [
            { items: [{ key: 'nav.patients' }] },
            { items: [{ key: 'nav.patients' }] },
          ],
        },
      ],
      ['label > 40 chars', { sections: [{ label: 'x'.repeat(41), items: [] }] }],
      [
        '> 20 sections',
        { sections: Array.from({ length: 21 }, () => ({ items: [] })) },
      ],
      [
        'nested groups',
        {
          sections: [
            {
              items: [
                {
                  label: 'Outer',
                  group: true,
                  items: [
                    {
                      label: 'Inner',
                      group: true,
                      items: [{ key: 'nav.patients' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      [
        'external home route',
        {
          sections: [{ items: [{ key: 'nav.patients' }] }],
          homeRoute: 'https://evil.com',
        },
      ],
    ];
    for (const [name, body] of bad) {
      const res = await put(body);
      expect({ name, status: res.status }).toEqual({ name, status: 400 });
    }
    // Nothing of that was saved.
    expect(await nav()).toEqual(LAYOUT);
  });

  it('NAV-06 saving the same layout again: no new audit row, no version bump', async () => {
    await put(LAYOUT).expect(200);
    const v = await env.version();
    const a = await auditRows();
    await put(LAYOUT).expect(200);
    expect(await env.version()).toBe(v);
    expect(await auditRows()).toBe(a);
  });

  it('NAV-07 reset: DELETE → /me/access.nav = null', async () => {
    const v = await env.version();
    await env.del('/admin/navigation', w.people.OwnerA).expect(200);
    expect(await env.version()).toBe(v + 1);
    expect(await nav()).toBeNull();
    note('NAV-07', 'the sidebar showing the code default is covered by the vitest NAV-* cases');
  });
});
