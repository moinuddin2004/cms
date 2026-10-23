import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { ActorRef, ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import type { AuditEntry, AuditService } from 'src/common/audit/audit.service';
import { ConfigScope } from './entities/config-value.entity';
import { ScopeRef, SettingsCacheBus } from './settings-cache-bus';
import { SettingsRegistryService } from './settings-registry.service';
import { FakeDataSource } from './testing/fake-data-source';
import './theme/theme.settings';

const ORG = 'org-1';
const LOC = 'loc-1';
const actor: ActorRef = { userId: 'user-1', side: ActorSide.CLINIC };

/** An in-process bus shared by several service instances. */
class MemoryBus extends SettingsCacheBus {
  private handlers: ((s: ScopeRef) => void)[] = [];
  published: ScopeRef[] = [];
  publish = (scope: ScopeRef) => {
    this.published.push(scope);
    this.handlers.forEach((h) => h(scope));
    return Promise.resolve();
  };
  onInvalidate(h: (s: ScopeRef) => void) {
    this.handlers.push(h);
  }
}

function setup(ds = new FakeDataSource(), bus = new MemoryBus()) {
  ds.locations.rows.push({ id: LOC, organizationId: ORG });
  const audit = {
    record: jest
      .fn<Promise<boolean>, [unknown, ActorRef, AuditEntry]>()
      .mockResolvedValue(true),
  };
  const svc = new SettingsRegistryService(
    ds as unknown as DataSource,
    audit as unknown as AuditService,
    bus,
  );
  svc.onModuleInit();
  return { svc, ds, audit, bus };
}

const ctx = { organizationId: ORG, locationId: LOC };

describe('SettingsRegistryService', () => {
  describe('cascade', () => {
    it('falls back to the code default', async () => {
      const { svc } = setup();
      expect(await svc.get('theme.app_name', ctx)).toBe('Clinic Portal');
      expect(await svc.get('theme.logo_url', ctx)).toBeNull();
    });

    it('location → org → platform → default, each overriding the one above', async () => {
      const { svc } = setup();
      await svc.set(
        'theme.app_name',
        ConfigScope.PLATFORM,
        null,
        'Platform',
        actor,
      );
      expect(await svc.get('theme.app_name', ctx)).toBe('Platform');

      await svc.set(
        'theme.app_name',
        ConfigScope.ORG,
        ORG,
        'Smile Clinic',
        actor,
      );
      expect(await svc.get('theme.app_name', ctx)).toBe('Smile Clinic');

      await svc.set(
        'theme.app_name',
        ConfigScope.LOCATION,
        LOC,
        'Smile DHA',
        actor,
      );
      expect(await svc.get('theme.app_name', ctx)).toBe('Smile DHA');
      expect(await svc.get('theme.app_name', { organizationId: ORG })).toBe(
        'Smile Clinic',
      );
    });

    it('a cleared value inherits again', async () => {
      const { svc } = setup();
      await svc.set('theme.app_name', ConfigScope.ORG, ORG, 'Smile', actor);
      await svc.set('theme.app_name', ConfigScope.ORG, ORG, null, actor);
      expect(await svc.get('theme.app_name', ctx)).toBe('Clinic Portal');
    });

    it('ignores a stored value at a scope the key does not allow', async () => {
      const { svc, ds } = setup();
      ds.configValues.rows.push({
        id: 'x',
        scopeType: ConfigScope.LOCATION,
        scopeId: LOC,
        key: 'theme.brand_color',
        value: '#000000',
        isLocked: false,
      });
      expect(await svc.get('theme.brand_color', ctx)).toBe('#2563eb');
    });
  });

  describe('locks', () => {
    it('a platform lock wins over org and location values', async () => {
      const { svc, ds } = setup();
      ds.configValues.rows.push(
        {
          id: 'o',
          scopeType: ConfigScope.ORG,
          scopeId: ORG,
          key: 'theme.app_name',
          value: 'Org',
          isLocked: false,
        },
        {
          id: 'l',
          scopeType: ConfigScope.LOCATION,
          scopeId: LOC,
          key: 'theme.app_name',
          value: 'Loc',
          isLocked: false,
        },
      );
      await svc.set(
        'theme.app_name',
        ConfigScope.PLATFORM,
        null,
        'Brand',
        actor,
        {
          locked: true,
        },
      );
      expect(await svc.resolve('theme.app_name', ctx)).toEqual({
        value: 'Brand',
        source: ConfigScope.PLATFORM,
        lockedAt: ConfigScope.PLATFORM,
      });
    });

    it('a lock without a value freezes the inherited value', async () => {
      const { svc } = setup();
      await svc.set('theme.app_name', ConfigScope.ORG, ORG, null, actor, {
        locked: true,
      });
      await expect(
        svc.set('theme.app_name', ConfigScope.LOCATION, LOC, 'Branch', actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await svc.get('theme.app_name', ctx)).toBe('Clinic Portal');
    });

    it('refuses org writes to a key the platform locked', async () => {
      const { svc, audit } = setup();
      await svc.set(
        'theme.brand_color',
        ConfigScope.PLATFORM,
        null,
        '#111111',
        actor,
        {
          locked: true,
        },
      );
      audit.record.mockClear();
      await expect(
        svc.set('theme.brand_color', ConfigScope.ORG, ORG, '#222222', actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('refuses location writes to a key the org locked, but not other orgs', async () => {
      const { svc, ds } = setup();
      ds.locations.rows.push({ id: 'loc-2', organizationId: 'org-2' });
      await svc.set(
        'theme.logo_url',
        ConfigScope.ORG,
        ORG,
        'https://cdn.example.com/a.png',
        actor,
        {
          locked: true,
        },
      );
      await expect(
        svc.set(
          'theme.logo_url',
          ConfigScope.LOCATION,
          LOC,
          'https://cdn.example.com/b.png',
          actor,
        ),
      ).rejects.toMatchObject({ response: { code: 'SETTING_LOCKED' } });
      await expect(
        svc.set(
          'theme.logo_url',
          ConfigScope.LOCATION,
          'loc-2',
          'https://cdn.example.com/b.png',
          actor,
        ),
      ).resolves.toBeUndefined();
    });

    it('a location cannot lock', async () => {
      const { svc } = setup();
      await expect(
        svc.set('theme.app_name', ConfigScope.LOCATION, LOC, 'X', actor, {
          locked: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('validation', () => {
    it.each([
      ['theme.brand_color', '#12345'],
      ['theme.brand_color', 'blue'],
      ['theme.logo_url', 'javascript:alert(1)'],
      ['theme.sidebar_style', 'neon'],
      ['theme.default_mode', 'dim'],
      ['theme.app_name', '   '],
      ['theme.app_name', 42],
    ])('rejects %s = %p', async (key, value) => {
      const { svc } = setup();
      await expect(
        svc.set(key, ConfigScope.ORG, ORG, value, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown keys and disallowed scopes', async () => {
      const { svc } = setup();
      await expect(
        svc.set('theme.font', ConfigScope.ORG, ORG, 'Inter', actor),
      ).rejects.toThrow('Unknown setting');
      await expect(
        svc.set(
          'theme.brand_color',
          ConfigScope.LOCATION,
          LOC,
          '#000000',
          actor,
        ),
      ).rejects.toThrow("can't be set per location");
    });

    it('stores the normalised value', async () => {
      const { svc } = setup();
      await svc.set(
        'theme.brand_color',
        ConfigScope.ORG,
        ORG,
        '#ABCDEF',
        actor,
      );
      await svc.set('theme.app_name', ConfigScope.ORG, ORG, '  Smile  ', actor);
      expect(await svc.get('theme.brand_color', ctx)).toBe('#abcdef');
      expect(await svc.get('theme.app_name', ctx)).toBe('Smile');
    });
  });

  describe('writes', () => {
    it('bumps version and audits create then update; a no-op writes nothing', async () => {
      const { svc, ds, audit } = setup();
      await svc.set('theme.app_name', ConfigScope.ORG, ORG, 'A', actor);
      await svc.set('theme.app_name', ConfigScope.ORG, ORG, 'B', actor);
      await svc.set('theme.app_name', ConfigScope.ORG, ORG, 'B', actor);

      expect(ds.configValues.rows).toHaveLength(1);
      expect(ds.configValues.rows[0]).toMatchObject({
        value: 'B',
        version: 2,
        updatedBy: 'user-1',
      });
      expect(audit.record).toHaveBeenCalledTimes(2);
      expect(audit.record.mock.calls[0][2]).toMatchObject({
        organizationId: ORG,
        entityType: 'config_value',
        action: AuditAction.CREATE,
      });
      expect(audit.record.mock.calls[1][2]).toMatchObject({
        action: AuditAction.UPDATE,
        before: { value: 'A' },
        after: { value: 'B' },
      });
    });

    it('audits location writes under the location org', async () => {
      const { svc, audit } = setup();
      await svc.set(
        'theme.app_name',
        ConfigScope.LOCATION,
        LOC,
        'Branch',
        actor,
      );
      expect(audit.record.mock.calls[0][2].organizationId).toBe(ORG);
    });
  });

  describe('cache', () => {
    it('serves repeat reads from memory', async () => {
      const { svc, ds } = setup();
      await svc.get('theme.app_name', ctx);
      const calls = ds.configValues.findCalls;
      await svc.get('theme.brand_color', ctx);
      expect(ds.configValues.findCalls).toBe(calls);
    });

    it('a write invalidates this instance and publishes to the others', async () => {
      const ds = new FakeDataSource();
      const bus = new MemoryBus();
      const a = setup(ds, bus).svc;
      const b = new SettingsRegistryService(
        ds as unknown as DataSource,
        { record: jest.fn() } as unknown as AuditService,
        bus,
      );
      b.onModuleInit();

      expect(await b.get('theme.app_name', ctx)).toBe('Clinic Portal'); // cached in b
      await a.set('theme.app_name', ConfigScope.ORG, ORG, 'Fresh', actor);

      expect(bus.published).toEqual([
        { scopeType: ConfigScope.ORG, scopeId: ORG },
      ]);
      expect(await a.get('theme.app_name', ctx)).toBe('Fresh');
      expect(await b.get('theme.app_name', ctx)).toBe('Fresh');
    });

    it('without an invalidation, a stale entry expires after the TTL', async () => {
      const ds = new FakeDataSource();
      const { svc } = setup(ds, new MemoryBus());
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
      await svc.get('theme.app_name', ctx);
      ds.configValues.rows.push({
        id: 'z',
        scopeType: ConfigScope.ORG,
        scopeId: ORG,
        key: 'theme.app_name',
        value: 'Elsewhere',
        isLocked: false,
      });
      expect(await svc.get('theme.app_name', ctx)).toBe('Clinic Portal');
      now.mockReturnValue(1_000 + SettingsRegistryService.CACHE_TTL_MS + 1);
      expect(await svc.get('theme.app_name', ctx)).toBe('Elsewhere');
      now.mockRestore();
    });
  });
});
