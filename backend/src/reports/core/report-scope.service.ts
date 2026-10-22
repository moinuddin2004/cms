import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays, isYmd } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { AccessContext } from 'src/access/access-context';
import type { Permission } from 'src/access/catalog/permissions';
import { noPermission } from 'src/access/decorators/access.decorators';
import { dayCount, monthStart } from './report-dates';
import type { ReportQueryDto } from './report-query.dto';
import type { ReportParams, ReportScope } from './report.types';

/** Longest range a report may cover (keeps the SQL and the files bounded). */
const MAX_RANGE_DAYS = 3 * 366;

/**
 * How far a report may reach, from the permission that gates it:
 * - `perm` — its scope decides: `org` → may run for every location,
 *   `location` → the active one, `own` → the active one narrowed to the
 *   caller's own rows (only reports with a doctor filter can do that).
 * - `orgPerm` — when set, the "all locations" view needs `org` scope on
 *   this permission instead (finance overview: gated by the unscoped
 *   `finance.overview.view`, reach from `reports.financial.view`).
 */
export interface ReportScopeRule {
  perm: Permission;
  orgPerm?: Permission;
  /** The report can be narrowed to one doctor (`filters.doctor`). */
  doctorFilter?: boolean;
}

/**
 * Resolves where a report runs (the active location, or every location of
 * the organization for org-wide grants) and its clinic-local date range.
 */
@Injectable()
export class ReportScopeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  async resolve(
    tenant: TenantContext,
    access: AccessContext,
    rule: ReportScopeRule,
    q: Pick<ReportQueryDto, 'scope'>,
  ): Promise<ReportScope> {
    const { organizationId, locationId } = tenant;
    const reach = access.scope(rule.perm);
    if (!reach) throw noPermission([rule.perm]);

    const wholeOrg = q.scope === 'organization';
    const orgPerm = rule.orgPerm ?? rule.perm;
    if (wholeOrg && access.scope(orgPerm) !== 'org') {
      throw noPermission(
        [orgPerm],
        'Your access does not cover all locations together.',
      );
    }

    // `own` reach: only the caller's own rows, i.e. one doctor's.
    let doctorId: string | undefined;
    if (reach === 'own') {
      if (!rule.doctorFilter || !access.employeeId) {
        throw noPermission(
          [rule.perm],
          'Your access covers only your own data; this report has no per-doctor view.',
        );
      }
      doctorId = access.employeeId;
    }

    const rows = await sqlRows<{ id: string; name: string; org_name: string }>(
      this.dataSource,
      `SELECT l.id, l.name, o.name AS org_name
         FROM locations l JOIN organizations o ON o.id = l.organization_id
        WHERE l.organization_id = $1
          AND (${wholeOrg ? 'l.is_active' : 'l.id = $2'})
        ORDER BY l.is_main_branch DESC, l.name`,
      wholeOrg ? [organizationId] : [organizationId, locationId],
    );
    if (!rows.length) throw new BadRequestException('Location not found.');

    const tz = await this.clock.timezoneFor(locationId);
    return {
      organizationId,
      organizationName: rows[0].org_name,
      locationIds: rows.map((r) => r.id),
      label: wholeOrg ? `All locations (${rows.length})` : rows[0].name,
      wholeOrg,
      doctorId,
      tz,
      today: this.clock.today(tz),
    };
  }

  /** Report params from the query; defaults to this month so far. */
  params(scope: ReportScope, q: ReportQueryDto, limit: number): ReportParams {
    const to = q.to ?? scope.today;
    const from = q.from ?? monthStart(to);
    if (!isYmd(from) || !isYmd(to)) {
      throw new BadRequestException('Dates must be YYYY-MM-DD.');
    }
    if (from > to) {
      throw new BadRequestException('"From" must be on or before "to".');
    }
    if (dayCount(from, to) > MAX_RANGE_DAYS) {
      throw new BadRequestException('A report can cover at most 3 years.');
    }
    return {
      from,
      to,
      start: this.clock.dayRange(scope.tz, from).start,
      end: this.clock.dayRange(scope.tz, addDays(to, 1)).start,
      // An `own`-scoped caller sees only their own rows, whatever they ask.
      doctorId: scope.doctorId ?? q.doctorId,
      category: q.category,
      basis: q.basis ?? 'collected',
      limit,
    };
  }
}
