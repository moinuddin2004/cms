import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NavLayoutDto, navSectionsProblem } from './nav-layout.dto';

/** Same options as the app's global ValidationPipe. */
async function errorsOf(body: unknown): Promise<string[]> {
  const dto = plainToInstance(NavLayoutDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const flat: string[] = [];
  const walk = (list: typeof errors) => {
    for (const e of list) {
      flat.push(...Object.values(e.constraints ?? {}));
      walk(e.children ?? []);
    }
  };
  walk(errors);
  return flat;
}

const valid = {
  sections: [
    { items: [{ key: 'nav.dashboard' }] },
    {
      label: 'Finance',
      items: [
        { key: 'nav.finance', label: 'Money' },
        {
          label: 'Billing',
          group: true,
          icon: 'HandCoins',
          items: [{ key: 'nav.billing.desk', label: 'Cash counter' }],
        },
      ],
    },
  ],
  hidden: ['nav.finance'],
  homeRoute: '/queue/doctor',
};

describe('NavLayoutDto', () => {
  it('accepts a well-formed layout', async () => {
    expect(await errorsOf(valid)).toEqual([]);
  });

  it('rejects a bad key', async () => {
    const errors = await errorsOf({
      sections: [{ items: [{ key: 'Dashboard' }] }],
    });
    expect(errors.join()).toMatch(/nav\.something/);
    expect(
      await errorsOf({
        sections: [{ items: [{ key: 'nav.ok' }] }],
        hidden: ['nav.ok', 'billing'],
      }),
    ).not.toEqual([]);
  });

  it('rejects a duplicate key, also across sections and groups', async () => {
    const dup = await errorsOf({
      sections: [
        { items: [{ key: 'nav.patients' }] },
        {
          items: [
            { label: 'G', group: true, items: [{ key: 'nav.patients' }] },
          ],
        },
      ],
    });
    expect(dup.join()).toMatch(/duplicate key nav\.patients/);
  });

  it('rejects labels over 40 characters', async () => {
    const long = 'x'.repeat(41);
    expect(
      await errorsOf({
        sections: [{ items: [{ key: 'nav.patients', label: long }] }],
      }),
    ).not.toEqual([]);
    expect(
      await errorsOf({ sections: [{ label: long, items: [] }] }),
    ).not.toEqual([]);
    expect(
      await errorsOf({
        sections: [{ items: [{ label: long, group: true, items: [] }] }],
      }),
    ).not.toEqual([]);
  });

  it('rejects more than 20 sections', async () => {
    const sections = Array.from({ length: 21 }, () => ({ items: [] }));
    expect((await errorsOf({ sections })).join()).toMatch(/20/);
    expect(await errorsOf({ sections: sections.slice(0, 20) })).toEqual([]);
  });

  it('rejects groups nested in groups and unknown fields', async () => {
    expect(
      await errorsOf({
        sections: [
          {
            items: [
              {
                label: 'Outer',
                group: true,
                items: [{ label: 'Inner', group: true, items: [] }],
              },
            ],
          },
        ],
      }),
    ).not.toEqual([]);
    expect(
      await errorsOf({ sections: [], permissions: { 'patients.view': true } }),
    ).not.toEqual([]);
  });

  it('rejects off-site home routes', async () => {
    for (const homeRoute of ['//evil.test', 'https://evil.test', 'queue']) {
      expect(await errorsOf({ sections: [], homeRoute })).not.toEqual([]);
    }
  });
});

describe('navSectionsProblem', () => {
  it('needs a key on links and a label on groups', () => {
    expect(navSectionsProblem([{ items: [{ label: 'x' }] }])).toMatch(/key/);
    expect(
      navSectionsProblem([{ items: [{ group: true, items: [] }] }]),
    ).toMatch(/label/);
    expect(
      navSectionsProblem([
        { items: [{ key: 'nav.a', items: [{ key: 'nav.b' }] }] },
      ]),
    ).toMatch(/group: true/);
    expect(navSectionsProblem(valid.sections)).toBeNull();
  });
});
