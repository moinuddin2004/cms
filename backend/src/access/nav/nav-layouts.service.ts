import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditService } from 'src/common/audit/audit.service';
import { AuditAction } from 'src/common/audit/audit.enums';
import type { ActorRef } from 'src/common/audit/audit.enums';
import { AccessVersionService } from '../version/access-version.service';
import { NavLayout } from './nav-layout.entity';
import type { NavLayoutJson } from './nav-layout.types';

export const NAV_LAYOUT_ENTITY_TYPE = 'nav_layout';

/** `GET /admin/navigation` payload. */
export interface NavLayoutView {
  layout: NavLayoutJson;
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
}

const toView = (row: NavLayout): NavLayoutView => ({
  layout: row.layout,
  version: row.version,
  updatedBy: row.updatedBy,
  updatedAt: row.updatedAt,
});

/** Plain JSON (drops undefined props and class prototypes of the DTO). */
const toJson = (layout: NavLayoutJson): NavLayoutJson =>
  JSON.parse(JSON.stringify(layout)) as NavLayoutJson;

/** JSON with sorted object keys — jsonb doesn't keep key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

/**
 * Clinic sidebar layouts (v1: the clinic default only, `role_id` NULL).
 * Every write is audited (`entity_type` nav_layout) and bumps the org's
 * `access_version`, so open tabs refetch `/me/access` and redraw the sidebar.
 */
@Injectable()
export class NavLayoutsService {
  constructor(
    @InjectRepository(NavLayout)
    private readonly repo: Repository<NavLayout>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly versions: AccessVersionService,
  ) {}

  /** The clinic default layout row, or null (= the web app's code default). */
  async getClinic(organizationId: string): Promise<NavLayoutView | null> {
    const row = await this.repo.findOne({
      where: { organizationId, roleId: IsNull() },
    });
    return row ? toView(row) : null;
  }

  /** Just the layout JSON, for `/me/access`. */
  async clinicLayout(organizationId: string): Promise<NavLayoutJson | null> {
    const row = await this.repo.findOne({
      where: { organizationId, roleId: IsNull() },
      select: { id: true, layout: true },
    });
    return row?.layout ?? null;
  }

  async saveClinic(
    organizationId: string,
    layout: NavLayoutJson,
    actor: ActorRef,
  ): Promise<NavLayoutView> {
    const next = toJson(layout);
    const { row, changed } = await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(NavLayout);
      const existing = await repo.findOne({
        where: { organizationId, roleId: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) {
        // Same layout again: not an event, keep the version as it was.
        if (canonical(existing.layout) === canonical(next)) {
          return { row: existing, changed: false };
        }
        await this.audit.record(em, actor, {
          organizationId,
          entityType: NAV_LAYOUT_ENTITY_TYPE,
          entityId: existing.id,
          action: AuditAction.UPDATE,
          before: { layout: existing.layout },
          after: { layout: next },
        });
        existing.layout = next;
        existing.version += 1;
        existing.updatedBy = actor.userId;
        return { row: await repo.save(existing), changed: true };
      }
      const created = await repo.save(
        repo.create({
          organizationId,
          roleId: null,
          layout: next,
          version: 1,
          updatedBy: actor.userId,
        }),
      );
      await this.audit.record(em, actor, {
        organizationId,
        entityType: NAV_LAYOUT_ENTITY_TYPE,
        entityId: created.id,
        action: AuditAction.CREATE,
        after: { layout: next },
      });
      return { row: created, changed: true };
    });
    if (changed) await this.versions.bumpQuietly(organizationId);
    return toView(row);
  }

  /** Back to the code default. False when there was nothing to reset. */
  async resetClinic(organizationId: string, actor: ActorRef): Promise<boolean> {
    const removed = await this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(NavLayout);
      const existing = await repo.findOne({
        where: { organizationId, roleId: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!existing) return false;
      // audit_logs has no "delete" action: a reset is the layout going to null.
      await this.audit.record(em, actor, {
        organizationId,
        entityType: NAV_LAYOUT_ENTITY_TYPE,
        entityId: existing.id,
        action: AuditAction.UPDATE,
        before: { layout: existing.layout },
        after: { layout: null },
      });
      await repo.delete({ id: existing.id });
      return true;
    });
    if (removed) await this.versions.bumpQuietly(organizationId);
    return removed;
  }
}
