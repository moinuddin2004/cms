import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { AuditAction, ActorRef } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { pgError } from 'src/common/database/sql';
import { Location } from 'src/locations/entities/location.entity';
import { ConfigScope, ConfigValue } from './entities/config-value.entity';
import {
  getSettingDefinition,
  scopeAllowed,
  SettingDefinition,
  SettingValidationError,
} from './setting-definition';
import { ScopeRef, SettingsCacheBus } from './settings-cache-bus';

export interface SettingsContext {
  organizationId?: string | null;
  locationId?: string | null;
}

/** `value`: undefined = keep, null = clear (inherit). `locked`: undefined = keep. */
export interface SettingWrite {
  key: string;
  value?: unknown;
  locked?: boolean;
}

/** The rows that apply to one read, one per scope (missing = nothing set). */
export interface SettingLayers {
  platform?: ConfigValue;
  org?: ConfigValue;
  location?: ConfigValue;
}

export interface ResolvedSetting {
  value: unknown;
  /** Where the effective value came from. */
  source: ConfigScope | 'default';
  /** The highest scope whose lock froze the value, if any. */
  lockedAt: ConfigScope | null;
}

const ORDER: ConfigScope[] = [
  ConfigScope.PLATFORM,
  ConfigScope.ORG,
  ConfigScope.LOCATION,
];

const LAYER: Record<ConfigScope, keyof SettingLayers> = {
  [ConfigScope.PLATFORM]: 'platform',
  [ConfigScope.ORG]: 'org',
  [ConfigScope.LOCATION]: 'location',
};

/**
 * The cascade, top-down: platform → org → location, each value overriding
 * the one above it, falling back to the code default. A lock stops the walk,
 * so a value locked higher up wins over anything lower.
 */
export function resolveSetting(
  def: SettingDefinition,
  layers: SettingLayers,
): ResolvedSetting {
  let value: unknown = def.default;
  let source: ResolvedSetting['source'] = 'default';
  for (const scope of ORDER) {
    const row = layers[LAYER[scope]];
    if (!row || !scopeAllowed(def, scope)) continue;
    if (row.value !== null && row.value !== undefined) {
      value = row.value;
      source = scope;
    }
    if (row.isLocked && def.lockable) return { value, source, lockedAt: scope };
  }
  return { value, source, lockedAt: null };
}

const cacheKey = (s: ScopeRef) => `${s.scopeType}:${s.scopeId ?? ''}`;

/**
 * Hybrid settings (design doc decision 2): typed settings tables stay as
 * they are; this registry (`config_values`) holds theme and new long-tail
 * settings declared with `defineSetting`.
 */
@Injectable()
export class SettingsRegistryService implements OnModuleInit {
  /** Safety net for a missed invalidation (Redis down). */
  static readonly CACHE_TTL_MS = 60_000;

  private readonly cache = new Map<
    string,
    { rows: Map<string, ConfigValue>; at: number }
  >();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly bus: SettingsCacheBus,
  ) {}

  onModuleInit() {
    this.bus.onInvalidate((scope) => this.cache.delete(cacheKey(scope)));
  }

  async get<T = unknown>(key: string, ctx: SettingsContext = {}): Promise<T> {
    return (await this.resolve(key, ctx)).value as T;
  }

  async getMany(
    keys: string[],
    ctx: SettingsContext = {},
  ): Promise<Record<string, unknown>> {
    const layers = await this.loadLayers(ctx);
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = resolveSetting(this.definition(key), pick(layers, key)).value;
    }
    return out;
  }

  async resolve(
    key: string,
    ctx: SettingsContext = {},
  ): Promise<ResolvedSetting> {
    const layers = await this.loadLayers(ctx);
    return resolveSetting(this.definition(key), pick(layers, key));
  }

  /** The raw rows for each key at each scope of `ctx`, for admin screens. */
  async layers(
    keys: string[],
    ctx: SettingsContext = {},
  ): Promise<Record<string, SettingLayers>> {
    const all = await this.loadLayers(ctx);
    return Object.fromEntries(keys.map((k) => [k, pick(all, k)]));
  }

  set(
    key: string,
    scopeType: ConfigScope,
    scopeId: string | null,
    value: unknown,
    actor: ActorRef,
    options: { locked?: boolean } = {},
  ): Promise<void> {
    return this.setMany(
      scopeType,
      scopeId,
      [{ key, value, locked: options.locked }],
      actor,
    );
  }

  /**
   * Validate and write several keys at one scope in one transaction:
   * refuses keys locked at a higher scope, bumps each row's `version`,
   * writes an audit row per change, then invalidates every instance's cache.
   */
  async setMany(
    scopeType: ConfigScope,
    scopeId: string | null,
    writes: SettingWrite[],
    actor: ActorRef,
  ): Promise<void> {
    if ((scopeType === ConfigScope.PLATFORM) !== (scopeId === null)) {
      throw new BadRequestException('Platform scope takes no scope id');
    }
    const clean = writes.map((w) => this.validate(w, scopeType));

    try {
      await this.dataSource.transaction(async (manager) => {
        const organizationId = await this.organizationOf(
          manager,
          scopeType,
          scopeId,
        );
        const above = await this.lockedAbove(
          manager,
          scopeType,
          organizationId,
          clean.map((w) => w.key),
        );
        const locked = clean.filter((w) => above.has(w.key)).map((w) => w.key);
        if (locked.length) {
          throw new ForbiddenException({
            message: `Locked at a higher level: ${locked.join(', ')}`,
            code: 'SETTING_LOCKED',
            keys: locked,
          });
        }
        for (const w of clean) {
          await this.writeOne(
            manager,
            scopeType,
            scopeId,
            organizationId,
            w,
            actor,
          );
        }
      });
    } catch (err) {
      if (pgError(err).code === '23505') {
        throw new ConflictException('Setting changed concurrently, retry');
      }
      throw err;
    }

    const scope = { scopeType, scopeId };
    this.cache.delete(cacheKey(scope));
    await this.bus.publish(scope);
  }

  private definition(key: string): SettingDefinition {
    const def = getSettingDefinition(key);
    if (!def) throw new BadRequestException(`Unknown setting "${key}"`);
    return def;
  }

  private validate(w: SettingWrite, scope: ConfigScope): SettingWrite {
    const def = this.definition(w.key);
    if (!scopeAllowed(def, scope)) {
      throw new BadRequestException(`"${w.key}" can't be set per ${scope}`);
    }
    if (w.locked !== undefined) {
      if (!def.lockable) {
        throw new BadRequestException(`"${w.key}" can't be locked`);
      }
      if (w.locked && scope === ConfigScope.LOCATION) {
        throw new BadRequestException('Locations are the lowest scope');
      }
    }
    if (w.value === undefined || w.value === null) return w;
    try {
      return { ...w, value: def.schema.parse(w.value) };
    } catch (err) {
      if (err instanceof SettingValidationError) {
        throw new BadRequestException(`"${w.key}" ${err.message}`);
      }
      throw err;
    }
  }

  private async writeOne(
    manager: EntityManager,
    scopeType: ConfigScope,
    scopeId: string | null,
    organizationId: string | null,
    w: SettingWrite,
    actor: ActorRef,
  ): Promise<void> {
    const repo = manager.getRepository(ConfigValue);
    const existing = await repo.findOne({
      where: { scopeType, scopeId: scopeId ?? IsNull(), key: w.key },
      lock: { mode: 'pessimistic_write' },
    });
    const before = existing
      ? { value: existing.value ?? null, isLocked: existing.isLocked }
      : null;
    const after = {
      value: w.value === undefined ? (before?.value ?? null) : w.value,
      isLocked: w.locked ?? before?.isLocked ?? false,
    };
    if (
      before &&
      JSON.stringify(before.value) === JSON.stringify(after.value) &&
      before.isLocked === after.isLocked
    ) {
      return;
    }
    if (!before && after.value === null && !after.isLocked) return;

    const row =
      existing ?? repo.create({ scopeType, scopeId, key: w.key, version: 0 });
    row.value = after.value;
    row.isLocked = after.isLocked;
    row.version += 1;
    row.updatedBy = actor.userId;
    const saved = await repo.save(row);

    await this.audit.record(manager, actor, {
      organizationId,
      entityType: 'config_value',
      entityId: saved.id,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      before: before ? { key: w.key, scope: scopeType, ...before } : null,
      after: { key: w.key, scope: scopeType, ...after },
    });
  }

  /** The organization a scope belongs to (null for platform). */
  private async organizationOf(
    manager: EntityManager,
    scopeType: ConfigScope,
    scopeId: string | null,
  ): Promise<string | null> {
    if (scopeType === ConfigScope.PLATFORM) return null;
    if (scopeType === ConfigScope.ORG) return scopeId;
    const location = await manager.getRepository(Location).findOne({
      where: { id: scopeId! },
      select: { id: true, organizationId: true },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location.organizationId;
  }

  /** Keys locked at a scope above `scopeType` — read fresh, not cached. */
  private async lockedAbove(
    manager: EntityManager,
    scopeType: ConfigScope,
    organizationId: string | null,
    keys: string[],
  ): Promise<Set<string>> {
    if (scopeType === ConfigScope.PLATFORM || !keys.length) return new Set();
    const base = { isLocked: true, key: In(keys) };
    const rows = await manager.getRepository(ConfigValue).find({
      select: { id: true, key: true },
      where: [
        { ...base, scopeType: ConfigScope.PLATFORM, scopeId: IsNull() },
        ...(scopeType === ConfigScope.LOCATION && organizationId
          ? [{ ...base, scopeType: ConfigScope.ORG, scopeId: organizationId }]
          : []),
      ],
    });
    return new Set(
      rows.map((r) => r.key).filter((k) => this.definition(k).lockable),
    );
  }

  private async loadLayers(ctx: SettingsContext) {
    const [platform, org, location] = await Promise.all([
      this.scopeRows({ scopeType: ConfigScope.PLATFORM, scopeId: null }),
      ctx.organizationId
        ? this.scopeRows({
            scopeType: ConfigScope.ORG,
            scopeId: ctx.organizationId,
          })
        : undefined,
      ctx.locationId
        ? this.scopeRows({
            scopeType: ConfigScope.LOCATION,
            scopeId: ctx.locationId,
          })
        : undefined,
    ]);
    return { platform, org, location };
  }

  private async scopeRows(scope: ScopeRef): Promise<Map<string, ConfigValue>> {
    const key = cacheKey(scope);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < SettingsRegistryService.CACHE_TTL_MS) {
      return hit.rows;
    }
    const rows = await this.dataSource.getRepository(ConfigValue).find({
      where: { scopeType: scope.scopeType, scopeId: scope.scopeId ?? IsNull() },
    });
    const map = new Map(rows.map((r) => [r.key, r]));
    this.cache.set(key, { rows: map, at: Date.now() });
    return map;
  }
}

function pick(
  layers: {
    platform: Map<string, ConfigValue>;
    org?: Map<string, ConfigValue>;
    location?: Map<string, ConfigValue>;
  },
  key: string,
): SettingLayers {
  return {
    platform: layers.platform.get(key),
    org: layers.org?.get(key),
    location: layers.location?.get(key),
  };
}
