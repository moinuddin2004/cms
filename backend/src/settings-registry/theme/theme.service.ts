import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorRef } from 'src/common/audit/audit.enums';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { ConfigScope } from '../entities/config-value.entity';
import {
  getSettingDefinition,
  scopeAllowed,
  SettingDefinition,
} from '../setting-definition';
import {
  resolveSetting,
  SettingsContext,
  SettingsRegistryService,
  SettingWrite,
} from '../settings-registry.service';
import { ResolvedTheme, shortThemeKey, THEME_KEYS } from './theme.settings';
import { UpdateLocationThemeDto, UpdateThemeDto } from './theme.dto';

interface ScopeCell {
  value: unknown;
  locked: boolean;
}

/** One key on an admin screen: what each scope holds and what applies. */
export interface ThemeKeyView {
  key: string;
  scopes: ConfigScope[];
  lockable: boolean;
  default: unknown;
  platform: ScopeCell;
  org?: ScopeCell;
  location?: ScopeCell;
  /** The value that applies at the scope being edited. */
  effective: unknown;
  /** The value that applies when this scope sets nothing. */
  inherited: unknown;
  /** Locked by a scope above the one being edited — read-only there. */
  lockedAbove: boolean;
}

const cell = (row?: { value: unknown; isLocked: boolean }): ScopeCell => ({
  value: row?.value ?? null,
  locked: row?.isLocked ?? false,
});

const ORG_KEYS = THEME_KEYS.filter((k) =>
  scopeAllowed(getSettingDefinition(k)!, ConfigScope.ORG),
);
const LOCATION_KEYS = THEME_KEYS.filter((k) =>
  scopeAllowed(getSettingDefinition(k)!, ConfigScope.LOCATION),
);

@Injectable()
export class ThemeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly registry: SettingsRegistryService,
  ) {}

  /** The theme for a tenant — theme keys only, safe for the public login page. */
  async resolve(ctx: SettingsContext): Promise<ResolvedTheme> {
    const values = await this.registry.getMany(THEME_KEYS, ctx);
    return Object.fromEntries(
      THEME_KEYS.map((k) => [shortThemeKey(k), values[k] ?? null]),
    ) as unknown as ResolvedTheme;
  }

  /**
   * Pre-auth theme. An unknown org (e.g. a stale remembered id) gets the
   * platform theme; a location outside the org is ignored.
   */
  async resolvePublic(
    organizationId: string,
    locationId?: string,
  ): Promise<ResolvedTheme> {
    const org = await this.dataSource.getRepository(Organization).findOne({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) return this.resolve({});
    const location = locationId
      ? await this.dataSource.getRepository(Location).findOne({
          where: { id: locationId, organizationId },
          select: { id: true },
        })
      : null;
    return this.resolve({ organizationId, locationId: location?.id ?? null });
  }

  async platformView(): Promise<ThemeKeyView[]> {
    const layers = await this.registry.layers(THEME_KEYS);
    return THEME_KEYS.map((key) => {
      const def = getSettingDefinition(key)!;
      const l = layers[key];
      return {
        ...this.base(def),
        platform: cell(l.platform),
        effective: resolveSetting(def, l).value,
        inherited: def.default,
        lockedAbove: false,
      };
    });
  }

  async orgView(organizationId: string): Promise<ThemeKeyView[]> {
    const layers = await this.registry.layers(ORG_KEYS, { organizationId });
    return ORG_KEYS.map((key) => {
      const def = getSettingDefinition(key)!;
      const l = layers[key];
      const above = resolveSetting(def, { platform: l.platform });
      return {
        ...this.base(def),
        platform: cell(l.platform),
        org: cell(l.org),
        effective: resolveSetting(def, l).value,
        inherited: above.value,
        lockedAbove: above.lockedAt !== null,
      };
    });
  }

  async locationView(
    organizationId: string,
    locationId: string,
  ): Promise<ThemeKeyView[]> {
    await this.assertLocation(organizationId, locationId);
    const layers = await this.registry.layers(LOCATION_KEYS, {
      organizationId,
      locationId,
    });
    return LOCATION_KEYS.map((key) => {
      const def = getSettingDefinition(key)!;
      const l = layers[key];
      const above = resolveSetting(def, { platform: l.platform, org: l.org });
      return {
        ...this.base(def),
        platform: cell(l.platform),
        org: cell(l.org),
        location: cell(l.location),
        effective: resolveSetting(def, l).value,
        inherited: above.value,
        lockedAbove: above.lockedAt !== null,
      };
    });
  }

  updatePlatform(dto: UpdateThemeDto, actor: ActorRef) {
    return this.registry.setMany(
      ConfigScope.PLATFORM,
      null,
      this.writes(dto.values, dto.locks, THEME_KEYS),
      actor,
    );
  }

  updateOrg(organizationId: string, dto: UpdateThemeDto, actor: ActorRef) {
    return this.registry.setMany(
      ConfigScope.ORG,
      organizationId,
      this.writes(dto.values, dto.locks, ORG_KEYS),
      actor,
    );
  }

  async updateLocation(
    organizationId: string,
    locationId: string,
    dto: UpdateLocationThemeDto,
    actor: ActorRef,
  ) {
    await this.assertLocation(organizationId, locationId);
    return this.registry.setMany(
      ConfigScope.LOCATION,
      locationId,
      this.writes(dto.values, undefined, LOCATION_KEYS),
      actor,
    );
  }

  private base(def: SettingDefinition) {
    return {
      key: shortThemeKey(def.key),
      scopes: def.scopes,
      lockable: def.lockable,
      default: def.default,
    };
  }

  /** Short keys → registry writes, refusing anything outside `allowed`. */
  private writes(
    values: Record<string, unknown> = {},
    locks: Record<string, boolean> = {},
    allowed: string[],
  ): SettingWrite[] {
    const byKey = new Map<string, SettingWrite>();
    const entry = (short: string) => {
      const key = `theme.${short}`;
      if (!allowed.includes(key)) {
        throw new BadRequestException(`"${short}" can't be set here`);
      }
      const w = byKey.get(key) ?? { key };
      byKey.set(key, w);
      return w;
    };
    for (const [short, value] of Object.entries(values)) {
      // An empty string clears, like null (e.g. a removed logo).
      entry(short).value = value === '' ? null : value;
    }
    for (const [short, locked] of Object.entries(locks)) {
      if (typeof locked !== 'boolean') {
        throw new BadRequestException(`Lock for "${short}" must be true/false`);
      }
      entry(short).locked = locked;
    }
    if (!byKey.size) throw new BadRequestException('Nothing to update');
    return [...byKey.values()];
  }

  private async assertLocation(organizationId: string, locationId: string) {
    const exists = await this.dataSource.getRepository(Location).exists({
      where: { id: locationId, organizationId },
    });
    if (!exists) throw new NotFoundException('Location not found');
  }
}
