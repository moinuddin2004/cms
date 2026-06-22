import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
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
  /** In-memory cache: orgId → Set of enabled feature keys */
  private readonly cache = new Map<string, Set<string>>();

  constructor(
    @InjectRepository(FeatureCatalog)
    private readonly catalogRepo: Repository<FeatureCatalog>,
    @InjectRepository(OrgFeatureFlag)
    private readonly flagRepo: Repository<OrgFeatureFlag>,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Seed the catalog on startup (upsert by key — safe to run repeatedly).
   */
  async onModuleInit(): Promise<void> {
    await this.seedCatalog();
  }

  // ── Catalog ────────────────────────────────────────────────────────

  /**
   * Upsert all seed features into the catalog.
   */
  async seedCatalog(): Promise<void> {
    for (const seed of FEATURE_CATALOG_SEED) {
      const existing = await this.catalogRepo.findOne({
        where: { key: seed.key },
      });
      if (existing) {
        // Keep curated fields fresh, but don't clobber manual overrides of isActive
        existing.name = seed.name;
        existing.module = seed.module;
        existing.description = seed.description;
        existing.specialtyTags = seed.specialtyTags;
        existing.enabledByDefault = seed.enabledByDefault;
        existing.sortOrder = seed.sortOrder;
        await this.catalogRepo.save(existing);
      } else {
        await this.catalogRepo.save(this.catalogRepo.create(seed));
      }
    }
    this.logger.info(
      `Feature catalog seeded (${FEATURE_CATALOG_SEED.length} features)`,
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
        isEnabled: enabledMap.get(item.key) ?? false,
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
   */
  async getEnabledFeatures(orgId: string): Promise<Set<string>> {
    const cached = this.cache.get(orgId);
    if (cached) return cached;

    const flags = await this.flagRepo.find({
      where: { organizationId: orgId, isEnabled: true },
    });
    const set = new Set(flags.map((f) => f.featureKey));
    this.cache.set(orgId, set);
    return set;
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
