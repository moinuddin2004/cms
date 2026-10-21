import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays, isYmd } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { dayCount, monthStart } from './report-dates';
import type { ReportQueryDto } from './report-query.dto';
import type { ReportParams, ReportScope } from './report.types';

/** Longest range a report may cover (keeps the SQL and the files bounded). */
const MAX_RANGE_DAYS = 3 * 366;

/**
 * Resolves where a report runs (the active location, or every location of
 * the organization for its owners) and its clinic-local date range.
 */
@Injectable()
export class ReportScopeService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly authorization: AuthorizationService,
  ) {}

  async resolve(
    tenant: TenantContext,
    userId: string,
    q: Pick<ReportQueryDto, 'scope'>,
  ): Promise<ReportScope> {
    const { organizationId, locationId } = tenant;
    const wholeOrg = q.scope === 'organization';
    if (
      wholeOrg &&
      !(await this.authorization.isOwner(userId, organizationId)) &&
      !(await this.authorization.isSuperAdmin(userId))
    ) {
      throw new ForbiddenException(
        'Only the organization owner can see all locations together.',
      );
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
      doctorId: q.doctorId,
      category: q.category,
      basis: q.basis ?? 'collected',
      limit,
    };
  }
}
