import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuditService } from 'src/common/audit/audit.service';
import { ActorRef, AuditAction } from 'src/common/audit/audit.enums';
import { snapshotOf } from 'src/common/audit/audit-diff';
import { AccessVersionService } from 'src/access/version/access-version.service';
import {
  expandImplies,
  normalizeGrants,
  PERMISSION_KEYS,
  PERMISSIONS,
  Permission,
} from 'src/access/catalog/permissions';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { Location } from 'src/locations/entities/location.entity';
import { FeatureCatalog } from './entities/feature-catalog.entity';
import { OrgFeatureFlag } from './entities/org-feature-flag.entity';
import { LocationFeatureOverride } from './entities/location-feature-override.entity';
import {
  FeatureFlagsService,
  ModuleFeatureGroup,
} from './feature-flags.service';
import { featureState } from './feature-state';

const FLAG_FIELDS = [
  'featureKey',
  'isEntitled',
  'entitledUntil',
  'isEnabled',
] as const;
const OVERRIDE_FIELDS = ['featureKey', 'locationId', 'isDisabled'] as const;

/** A feature row on the owner's Features page. */
export type OwnerFeature = ModuleFeatureGroup['features'][number] & {
  /** How many catalog permissions this feature carries. */
  permissionCount: number;
  /** Locations where the owner switched this feature off. */
  disabledLocationIds: string[];
};

export interface OwnerFeaturesView {
  modules: Array<{ module: string; features: OwnerFeature[] }>;
  locations: Array<{ id: string; name: string }>;
}

/** What turning a feature off takes away (for the confirm dialog). */
export interface FeatureImpact {
  featureKey: string;
  name: string;
  permissions: Array<{ key: string; label: string; group: string }>;
  roles: Array<{ id: string; name: string; permissions: string[] }>;
}

export interface EntitlementChange {
  entitled: boolean;
  /** Trial expiry (ISO); ignored when `entitled` is false. */
  until?: string | null;
}

/** 403 for an owner switching a feature the org is not entitled to. */
export function notEntitled(featureKey: string, lockedReason: string) {
  return new ForbiddenException({
    code: 'NOT_ENTITLED',
    featureKey,
    lockedReason,
    message:
      lockedReason === 'trial_expired'
        ? `The trial of "${featureKey}" has ended — contact the platform admin`
        : `"${featureKey}" is not part of this clinic's plan — contact the platform admin`,
  });
}

/**
 * Writes behind the super admin's entitlement screen and the owner's
 * Features page. Every change is one transaction with its `audit_logs` row;
 * org flag writes bump `access_version` through the entity subscriber,
 * location overrides bump it explicitly.
 */
@Injectable()
export class FeatureAdminService {
  constructor(
    @InjectRepository(FeatureCatalog)
    private readonly catalogRepo: Repository<FeatureCatalog>,
    @InjectRepository(OrgFeatureFlag)
    private readonly flagRepo: Repository<OrgFeatureFlag>,
    @InjectRepository(LocationFeatureOverride)
    private readonly overrideRepo: Repository<LocationFeatureOverride>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(EmploymentRole)
    private readonly roleRepo: Repository<EmploymentRole>,
    private readonly flags: FeatureFlagsService,
    private readonly audit: AuditService,
    private readonly versions: AccessVersionService,
  ) {}

  // ── Super admin: entitlement ───────────────────────────────────────

  async setEntitlement(
    orgId: string,
    featureKey: string,
    change: EntitlementChange,
    actor: ActorRef,
  ): Promise<OrgFeatureFlag> {
    const item = await this.catalogItem(featureKey);
    const until = this.parseUntil(change);
    const [saved] = await this.flagRepo.manager.transaction((m) =>
      this.writeFlags(m, orgId, [item], actor, (flag) => {
        flag.isEntitled = change.entitled;
        flag.entitledUntil = until;
        flag.entitledBy = actor.userId;
        flag.entitledAt = new Date();
      }),
    );
    this.flags.invalidateCache(orgId);
    return saved;
  }

  /** Entitle (or withdraw) many features — a list of keys or a whole module. */
  async bulkSetEntitlement(
    orgId: string,
    target: { featureKeys?: string[]; module?: string },
    change: EntitlementChange,
    actor: ActorRef,
  ): Promise<{ updated: number }> {
    const items = await this.catalogItems(target);
    const until = this.parseUntil(change);
    const saved = await this.flagRepo.manager.transaction((m) =>
      this.writeFlags(m, orgId, items, actor, (flag) => {
        flag.isEntitled = change.entitled;
        flag.entitledUntil = until;
        flag.entitledBy = actor.userId;
        flag.entitledAt = new Date();
      }),
    );
    this.flags.invalidateCache(orgId);
    return { updated: saved.length };
  }

  // ── Owner switch (super admin may flip it too) ─────────────────────

  /**
   * Switch a feature on/off for the org. With `requireEntitled` (the owner's
   * route) a feature the org is not entitled to is refused with 403
   * `NOT_ENTITLED`; the super admin can set it regardless.
   */
  async setEnabled(
    orgId: string,
    featureKey: string,
    enabled: boolean,
    actor: ActorRef,
    opts: { requireEntitled: boolean },
  ): Promise<OrgFeatureFlag> {
    const item = await this.catalogItem(featureKey);
    const [saved] = await this.flagRepo.manager.transaction((m) =>
      this.writeFlags(m, orgId, [item], actor, (flag, isNew) => {
        if (opts.requireEntitled) {
          const state = featureState(item, isNew ? undefined : flag);
          if (!state.entitled) {
            throw notEntitled(featureKey, state.lockedReason!);
          }
        }
        flag.isEnabled = enabled;
        flag.enabledBy = actor.userId ?? flag.enabledBy ?? null;
      }),
    );
    this.flags.invalidateCache(orgId);
    return saved;
  }

  async bulkSetEnabled(
    orgId: string,
    featureKeys: string[],
    enabled: boolean,
    actor: ActorRef,
  ): Promise<{ updated: number }> {
    if (featureKeys.length === 0) return { updated: 0 };
    const items = await this.catalogItems({ featureKeys });
    const saved = await this.flagRepo.manager.transaction((m) =>
      this.writeFlags(m, orgId, items, actor, (flag) => {
        flag.isEnabled = enabled;
        flag.enabledBy = actor.userId ?? flag.enabledBy ?? null;
      }),
    );
    this.flags.invalidateCache(orgId);
    return { updated: saved.length };
  }

  // ── Owner: per-location narrowing ──────────────────────────────────

  /**
   * Switch a feature off (or back to the org setting) at one location. A
   * location can only narrow: `disabled: false` never turns on a feature
   * the org has off.
   */
  async setLocationOverride(
    orgId: string,
    featureKey: string,
    locationId: string,
    disabled: boolean,
    actor: ActorRef,
  ): Promise<{ featureKey: string; locationId: string; disabled: boolean }> {
    await this.catalogItem(featureKey);
    const location = await this.locationRepo.findOne({
      where: { id: locationId, organizationId: orgId },
      select: { id: true },
    });
    if (!location) throw new NotFoundException('Location not found');

    const changed = await this.overrideRepo.manager.transaction(async (m) => {
      const repo = m.getRepository(LocationFeatureOverride);
      const existing = await repo.findOne({
        where: { locationId, featureKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (!existing && !disabled) return false; // already follows the org
      if (existing && existing.isDisabled === disabled) return false;

      const row =
        existing ??
        repo.create({ organizationId: orgId, locationId, featureKey });
      const before = existing ? snapshotOf(existing, OVERRIDE_FIELDS) : null;
      row.isDisabled = disabled;
      row.updatedBy = actor.userId;
      const saved = await repo.save(row);
      await this.audit.record(m, actor, {
        organizationId: orgId,
        entityType: 'location_feature_override',
        entityId: saved.id,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        before,
        after: snapshotOf(saved, OVERRIDE_FIELDS),
      });
      return true;
    });

    if (changed) {
      this.flags.invalidateCache(orgId);
      // Overrides are not watched by the access subscriber: bump here.
      await this.versions.bumpQuietly(orgId);
    }
    return { featureKey, locationId, disabled };
  }

  // ── Owner: reads ───────────────────────────────────────────────────

  async getOwnerView(orgId: string): Promise<OwnerFeaturesView> {
    const [groups, overrides, locations] = await Promise.all([
      this.flags.getCatalogWithOrgStatus(orgId),
      this.overrideRepo.find({
        where: { organizationId: orgId, isDisabled: true },
        select: { featureKey: true, locationId: true },
      }),
      this.locationRepo.find({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, name: true },
        order: { name: 'ASC' },
      }),
    ]);

    const disabledAt = new Map<string, string[]>();
    for (const o of overrides) {
      disabledAt.set(o.featureKey, [
        ...(disabledAt.get(o.featureKey) ?? []),
        o.locationId,
      ]);
    }
    const permissionCount = new Map<string, number>();
    for (const p of PERMISSION_KEYS) {
      const f = PERMISSIONS[p].feature;
      permissionCount.set(f, (permissionCount.get(f) ?? 0) + 1);
    }

    return {
      modules: groups.map((g) => ({
        module: g.module,
        features: g.features.map((f) => ({
          ...f,
          permissionCount: permissionCount.get(f.key) ?? 0,
          disabledLocationIds: disabledAt.get(f.key) ?? [],
        })),
      })),
      locations: locations.map((l) => ({ id: l.id, name: l.name })),
    };
  }

  /**
   * The catalog permissions a feature carries and the org's active roles
   * that grant any of them — what stops working when it is switched off.
   */
  async getImpact(orgId: string, featureKey: string): Promise<FeatureImpact> {
    const item = await this.catalogItem(featureKey);
    const perms = PERMISSION_KEYS.filter(
      (p) => PERMISSIONS[p].feature === featureKey,
    );
    const roles = perms.length
      ? await this.roleRepo.find({
          where: { organizationId: orgId, isActive: true },
          select: { id: true, name: true, permissions: true },
          order: { name: 'ASC' },
        })
      : [];

    return {
      featureKey,
      name: item.name,
      permissions: perms.map((p) => ({
        key: p,
        label: PERMISSIONS[p].label,
        group: PERMISSIONS[p].group,
      })),
      roles: roles.flatMap((r) => {
        const granted = expandImplies(normalizeGrants(r.permissions));
        const lost = perms.filter((p: Permission) => granted[p] !== undefined);
        return lost.length
          ? [{ id: r.id, name: r.name, permissions: lost }]
          : [];
      }),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private async catalogItem(key: string): Promise<FeatureCatalog> {
    const item = await this.catalogRepo.findOne({
      where: { key, isActive: true },
    });
    if (!item) throw new NotFoundException(`Unknown feature "${key}"`);
    return item;
  }

  private async catalogItems(target: {
    featureKeys?: string[];
    module?: string;
  }): Promise<FeatureCatalog[]> {
    if (!target.featureKeys?.length && !target.module) {
      throw new BadRequestException('Give featureKeys or module');
    }
    const items = await this.catalogRepo.find({
      where: {
        isActive: true,
        ...(target.featureKeys?.length ? { key: In(target.featureKeys) } : {}),
        ...(target.module ? { module: target.module } : {}),
      },
    });
    const found = new Set(items.map((i) => i.key));
    const unknown = (target.featureKeys ?? []).filter((k) => !found.has(k));
    if (unknown.length) {
      throw new NotFoundException(`Unknown feature(s): ${unknown.join(', ')}`);
    }
    if (!items.length) throw new NotFoundException('No features matched');
    return items;
  }

  private parseUntil(change: EntitlementChange): Date | null {
    if (!change.entitled || !change.until) return null;
    const until = new Date(change.until);
    if (Number.isNaN(until.getTime())) {
      throw new BadRequestException('until must be a date');
    }
    if (until.getTime() <= Date.now()) {
      throw new BadRequestException('until must be in the future');
    }
    return until;
  }

  /**
   * Load-or-create the org's rows for these features (locked), apply
   * `mutate`, save, and audit each row that actually changed. A new row
   * starts from the missing-row defaults (entitled, catalog default on).
   */
  private async writeFlags(
    m: EntityManager,
    orgId: string,
    items: FeatureCatalog[],
    actor: ActorRef,
    mutate: (flag: OrgFeatureFlag, isNew: boolean) => void,
  ): Promise<OrgFeatureFlag[]> {
    const repo = m.getRepository(OrgFeatureFlag);
    const existing = await repo.find({
      where: {
        organizationId: orgId,
        featureKey: In(items.map((i) => i.key)),
      },
      lock: { mode: 'pessimistic_write' },
    });
    const byKey = new Map(existing.map((f) => [f.featureKey, f]));

    const out: OrgFeatureFlag[] = [];
    for (const item of items) {
      const current = byKey.get(item.key);
      const flag =
        current ??
        repo.create({
          organizationId: orgId,
          featureKey: item.key,
          isEnabled: item.enabledByDefault,
          isEntitled: true,
          entitledUntil: null,
        });
      const before = snapshotOf(flag, FLAG_FIELDS);
      mutate(flag, !current);
      const after = snapshotOf(flag, FLAG_FIELDS);
      if (current && JSON.stringify(before) === JSON.stringify(after)) {
        out.push(current);
        continue;
      }
      const saved = await repo.save(flag);
      await this.audit.record(m, actor, {
        organizationId: orgId,
        entityType: 'org_feature_flag',
        entityId: saved.id,
        action: current ? AuditAction.UPDATE : AuditAction.CREATE,
        before: current ? before : null,
        after: snapshotOf(saved, FLAG_FIELDS),
      });
      out.push(saved);
    }
    return out;
  }
}
