import type { DataSource } from 'typeorm';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import type { AuditService } from 'src/common/audit/audit.service';
import { ConfigScope } from '../entities/config-value.entity';
import { defineSetting, s } from '../setting-definition';
import { SettingsCacheBus } from '../settings-cache-bus';
import { SettingsRegistryService } from '../settings-registry.service';
import { FakeDataSource } from '../testing/fake-data-source';
import { ThemeService } from './theme.service';

// A non-theme setting stored for the same org must never reach the public theme.
defineSetting('test.secret_note', {
  schema: s.string(),
  default: null,
  scopes: [ConfigScope.ORG],
  lockable: false,
});

const ORG = 'org-1';
const LOC = 'loc-1';
const actor: ActorRef = { userId: 'u', side: ActorSide.CLINIC };
const THEME_FIELDS = [
  'app_name',
  'brand_color',
  'default_mode',
  'favicon_url',
  'logo_dark_url',
  'logo_url',
  'sidebar_style',
];

function setup() {
  const ds = new FakeDataSource();
  ds.organizations.rows.push({ id: ORG });
  ds.locations.rows.push(
    { id: LOC, organizationId: ORG },
    { id: 'loc-other', organizationId: 'org-2' },
  );
  const bus: SettingsCacheBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    onInvalidate: jest.fn(),
  };
  const registry = new SettingsRegistryService(
    ds as unknown as DataSource,
    { record: jest.fn() } as unknown as AuditService,
    bus,
  );
  const theme = new ThemeService(ds as unknown as DataSource, registry);
  return { ds, registry, theme };
}

describe('ThemeService', () => {
  it('public theme returns theme keys only', async () => {
    const { registry, theme } = setup();
    await registry.set(
      'test.secret_note',
      ConfigScope.ORG,
      ORG,
      'hidden',
      actor,
    );
    await registry.set(
      'theme.brand_color',
      ConfigScope.ORG,
      ORG,
      '#0f766e',
      actor,
    );

    const result = await theme.resolvePublic(ORG);
    expect(Object.keys(result).sort()).toEqual(THEME_FIELDS);
    expect(result.brand_color).toBe('#0f766e');
    expect(JSON.stringify(result)).not.toContain('hidden');
  });

  it('public theme for an unknown org is the platform theme', async () => {
    const { registry, theme } = setup();
    await registry.set(
      'theme.brand_color',
      ConfigScope.ORG,
      ORG,
      '#0f766e',
      actor,
    );
    const result = await theme.resolvePublic(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(result.brand_color).toBe('#2563eb');
    expect(result.app_name).toBe('Clinic Portal');
  });

  it('public theme ignores a location of another org', async () => {
    const { registry, theme } = setup();
    await registry.set(
      'theme.app_name',
      ConfigScope.LOCATION,
      'loc-other',
      'Other',
      actor,
    );
    await registry.set(
      'theme.app_name',
      ConfigScope.LOCATION,
      LOC,
      'Mine',
      actor,
    );
    expect((await theme.resolvePublic(ORG, 'loc-other')).app_name).toBe(
      'Clinic Portal',
    );
    expect((await theme.resolvePublic(ORG, LOC)).app_name).toBe('Mine');
  });

  it('org view shows platform, org, effective and the platform lock', async () => {
    const { theme } = setup();
    await theme.updatePlatform(
      { values: { brand_color: '#111111' }, locks: { brand_color: true } },
      actor,
    );
    await theme.updateOrg(ORG, { values: { app_name: 'Smile' } }, actor);

    const view = await theme.orgView(ORG);
    const brand = view.find((k) => k.key === 'brand_color')!;
    const name = view.find((k) => k.key === 'app_name')!;
    expect(brand).toMatchObject({
      platform: { value: '#111111', locked: true },
      org: { value: null, locked: false },
      effective: '#111111',
      lockedAbove: true,
    });
    expect(name).toMatchObject({ effective: 'Smile', inherited: 'Clinic Portal' });
  });

  it('location overrides accept name and logos only', async () => {
    const { theme } = setup();
    await expect(
      theme.updateLocation(
        ORG,
        LOC,
        { values: { brand_color: '#000000' } },
        actor,
      ),
    ).rejects.toThrow("can't be set here");
    await theme.updateLocation(
      ORG,
      LOC,
      { values: { app_name: 'DHA' } },
      actor,
    );
    const view = await theme.locationView(ORG, LOC);
    expect(view.map((k) => k.key).sort()).toEqual([
      'app_name',
      'logo_dark_url',
      'logo_url',
    ]);
    expect(view.find((k) => k.key === 'app_name')!.effective).toBe('DHA');
  });

  it("refuses another org's location", async () => {
    const { theme } = setup();
    await expect(
      theme.updateLocation(
        ORG,
        'loc-other',
        { values: { app_name: 'X' } },
        actor,
      ),
    ).rejects.toThrow('Location not found');
  });

  it('an empty string clears a value', async () => {
    const { theme } = setup();
    await theme.updateOrg(
      ORG,
      { values: { logo_url: 'https://cdn.example.com/l.png' } },
      actor,
    );
    await theme.updateOrg(ORG, { values: { logo_url: '' } }, actor);
    expect((await theme.resolve({ organizationId: ORG })).logo_url).toBeNull();
  });
});
