import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FeatureCatalog } from './entities/feature-catalog.entity';
import { OrgFeatureFlag } from './entities/org-feature-flag.entity';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from './dto/feature-flags.dto';
import { FEATURE_CATALOG_SEED } from './feature-catalog.seed';
import { AppLogger } from 'src/common/services/logger.service';
import { AccessChangeBus } from 'src/access/version/access-change-bus';

/**
 * How long an org's enabled-set is trusted. Changes made on another instance
 * normally arrive over the access bus at once; this bounds staleness when a
 * bus message is missed (Redis down).
 */
export const FEATURE_CACHE_TTL_MS = 30_000;

/**
 * Feature grouped by module with per-org enabled status.
 */
export interface ModuleFeatureGroup {
  module: string;
  features: Array<{
    key: string;
    name: string;
    module: string;
    description: string | null;
    specialtyTags: string[];
    enabledByDefault: boolean;
    sortOrder: number;
    isEnabled: boolean;
  }>;
}

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  /** In-memory cache: orgId → enabled feature keys (+ when it was loaded) */
  private readonly cache = new Map<string, { keys: Set<string>; at: number }>();

  constructor(
    @InjectRepository(FeatureCatalog)
    private readonly catalogRepo: Repository<FeatureCatalog>,
    @InjectRepository(OrgFeatureFlag)
    private readonly flagRepo: Repository<OrgFeatureFlag>,
    private readonly logger: AppLogger,
    @Optional() bus?: AccessChangeBus,
  ) {
    // Flag changes bump the org's access version; every instance drops its
    // cached set when it hears about it.
    bus?.onChange((c) => this.invalidateCache(c.organizationId));
  }

  /**
   * Add catalog keys that are missing on startup (safe to run repeatedly).
   */
  async onModuleInit(): Promise<void> {
    await this.seedCatalog();
  }

  // ── Catalog ────────────────────────────────────────────────────────

  /**
   * Insert seed features whose key is not in the catalog yet. Existing rows
   * are never touched, so super-admin edits (name, default, active…) stick.
   */
  async seedCatalog(): Promise<void> {
    const existing = await this.catalogRepo.find({ select: { key: true } });
    const known = new Set(existing.map((c) => c.key));
    const missing = FEATURE_CATALOG_SEED.filter((seed) => !known.has(seed.key));
    if (missing.length > 0) {
      await this.catalogRepo
        .createQueryBuilder()
        .insert()
        .values(missing)
        .orIgnore() // another process may be seeding at the same time
        .execute();
    }
    this.logger.info(
      `Feature catalog checked (${missing.length} new of ${FEATURE_CATALOG_SEED.length})`,
      FeatureFlagsService.name,
    );
  }

  /**
   * Get all active catalog items, ordered by module + sortOrder.
   */
  async getCatalog(): Promise<FeatureCatalog[]> {
    return this.catalogRepo.find({
      where: { isActive: true },
      order: { module: 'ASC', sortOrder: 'ASC' },
    });
  }

  /**
   * Get catalog grouped by module, each feature carrying its enabled status for an org.
   */
  async getCatalogWithOrgStatus(orgId: string): Promise<ModuleFeatureGroup[]> {
    const catalog = await this.getCatalog();
    const flags = await this.flagRepo.find({
      where: { organizationId: orgId },
    });
    const enabledMap = new Map(flags.map((f) => [f.featureKey, f.isEnabled]));

    const groups = new Map<string, ModuleFeatureGroup>();
    for (const item of catalog) {
      if (!groups.has(item.module)) {
        groups.set(item.module, { module: item.module, features: [] });
      }
      groups.get(item.module)!.features.push({
        key: item.key,
        name: item.name,
        module: item.module,
        description: item.description,
        specialtyTags: item.specialtyTags,
        enabledByDefault: item.enabledByDefault,
        sortOrder: item.sortOrder,
        // No row yet → the catalog default applies.
        isEnabled: enabledMap.get(item.key) ?? item.enabledByDefault,
      });
    }
    return Array.from(groups.values());
  }

  async createCatalogItem(dto: CreateCatalogItemDto): Promise<FeatureCatalog> {
    const existing = await this.catalogRepo.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`Feature key "${dto.key}" already exists`);
    }
    return this.catalogRepo.save(this.catalogRepo.create(dto));
  }

  async updateCatalogItem(
    id: string,
    dto: UpdateCatalogItemDto,
  ): Promise<FeatureCatalog> {
    const item = await this.catalogRepo.findOneBy({ id });
    if (!item) throw new NotFoundException('Feature catalog item not found');
    Object.assign(item, dto);
    return this.catalogRepo.save(item);
  }

  // ── Org flags ──────────────────────────────────────────────────────

  /**
   * Create org_feature_flags rows from catalog defaults.
   * Idempotent — only inserts flags that don't already exist for the org.
   */
  async seedFlagsForOrg(orgId: string): Promise<void> {
    const catalog = await this.getCatalog();
    const existing = await this.flagRepo.find({
      where: { organizationId: orgId },
    });
    const existingKeys = new Set(existing.map((f) => f.featureKey));

    const toCreate = catalog
      .filter((item) => !existingKeys.has(item.key))
      .map((item) =>
        this.flagRepo.create({
          organizationId: orgId,
          featureKey: item.key,
          isEnabled: item.enabledByDefault,
        }),
      );

    if (toCreate.length > 0) {
      await this.flagRepo.save(toCreate);
    }
    this.invalidateCache(orgId);
  }

  /**
   * Toggle a single feature for an org (upsert pattern).
   */
  async toggleFeature(
    orgId: string,
    featureKey: string,
    isEnabled: boolean,
    userId?: string,
  ): Promise<OrgFeatureFlag> {
    let flag = await this.flagRepo.findOne({
      where: { organizationId: orgId, featureKey },
    });
    if (!flag) {
      flag = this.flagRepo.create({ organizationId: orgId, featureKey });
    }
    flag.isEnabled = isEnabled;
    flag.enabledBy = userId || flag.enabledBy || null;
    const saved = await this.flagRepo.save(flag);
    this.invalidateCache(orgId);
    return saved;
  }

  /**
   * Toggle many features at once for an org.
   */
  async bulkToggle(
    orgId: string,
    featureKeys: string[],
    isEnabled: boolean,
    userId?: string,
  ): Promise<{ updated: number }> {
    if (featureKeys.length === 0) return { updated: 0 };

    const existing = await this.flagRepo.find({
      where: { organizationId: orgId, featureKey: In(featureKeys) },
    });
    const existingByKey = new Map(existing.map((f) => [f.featureKey, f]));

    const toSave: OrgFeatureFlag[] = featureKeys.map((key) => {
      const flag =
        existingByKey.get(key) ??
        this.flagRepo.create({ organizationId: orgId, featureKey: key });
      flag.isEnabled = isEnabled;
      flag.enabledBy = userId || flag.enabledBy || null;
      return flag;
    });

    await this.flagRepo.save(toSave);
    this.invalidateCache(orgId);
    return { updated: toSave.length };
  }

  // ── Lookups (cached) ───────────────────────────────────────────────

  /**
   * Get the set of enabled feature keys for an org (cached in memory).
   * A feature without an org row falls back to the catalog's
   * `enabledByDefault`; an explicit row always wins.
   */
  async getEnabledFeatures(orgId: string): Promise<Set<string>> {
    const cached = this.cache.get(orgId);
    if (cached && Date.now() - cached.at < FEATURE_CACHE_TTL_MS) {
      return cached.keys;
    }

    const [flags, catalog] = await Promise.all([
      this.flagRepo.find({ where: { organizationId: orgId } }),
      this.getCatalog(),
    ]);
    const keys = resolveEnabledFeatures(flags, catalog);
    this.cache.set(orgId, { keys, at: Date.now() });
    return keys;
  }

  /**
   * Check whether a single feature is enabled for an org.
   */
  async isFeatureEnabled(orgId: string, featureKey: string): Promise<boolean> {
    const enabled = await this.getEnabledFeatures(orgId);
    return enabled.has(featureKey);
  }

  /**
   * Drop the cached enabled-set for an org (after any mutation).
   */
  invalidateCache(orgId: string): void {
    this.cache.delete(orgId);
  }
}

/**
 * Enabled keys = flags switched on + active catalog features that are on by
 * default and have no row for the org.
 */
export function resolveEnabledFeatures(
  flags: Pick<OrgFeatureFlag, 'featureKey' | 'isEnabled'>[],
  catalog: Pick<FeatureCatalog, 'key' | 'enabledByDefault'>[],
): Set<string> {
  const rows = new Set(flags.map((f) => f.featureKey));
  const keys = new Set(
    flags.filter((f) => f.isEnabled).map((f) => f.featureKey),
  );
  for (const item of catalog) {
    if (item.enabledByDefault && !rows.has(item.key)) keys.add(item.key);
  }
  return keys;
}
