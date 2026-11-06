import { RateLimit } from 'src/auth/guards/rate-limiter.guard';
import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import type { AccessContext } from 'src/access/access-context';
import {
  Access,
  AnyMember,
  Can,
  noPermission,
} from 'src/access/decorators/access.decorators';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { AuditService } from 'src/common/audit/audit.service';
import { ActorRef, ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { ClinicOverviewService } from './clinic/clinic-overview.service';
import { ReportExportQueryDto, ReportQueryDto } from './core/report-query.dto';
import { ReportScopeService } from './core/report-scope.service';
import { FinanceOverviewService } from './finance/finance-overview.service';
import { permissionOf, ReportsService, scopeRuleOf } from './reports.service';

/**
 * Reports and the two dashboards. Financial reports need
 * `reports.financial.view`, clinical / operational ones
 * `reports.clinical.view` (each implies its feature); downloads also need
 * `reports.export`. The grant's scope decides how far a report reaches
 * (ReportScopeService).
 */
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly scopes: ReportScopeService,
    private readonly finance: FinanceOverviewService,
    private readonly clinic: ClinicOverviewService,
    private readonly audit: AuditService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** The report, once the caller holds its permission (else 403). */
  private definition(key: string, access: AccessContext) {
    const def = this.reports.definition(key);
    const perm = permissionOf(def);
    if (!access.can(perm)) throw noPermission([perm]);
    return def;
  }

  /** Lists only the reports this caller can open (filtered per report). */
  @Get()
  @AnyMember()
  catalog(@Access() access: AccessContext) {
    return ResponseWrapper.success(this.reports.catalog(access));
  }

  @Get('finance/overview')
  @Can('finance.overview.view')
  async financeOverview(
    @Query() q: ReportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @Access() access: AccessContext,
  ) {
    const scope = await this.scopes.resolve(
      tenant,
      access,
      { perm: 'finance.overview.view', orgPerm: 'reports.financial.view' },
      q,
    );
    const params = this.scopes.params(scope, q, 0);
    return ResponseWrapper.success(await this.finance.overview(scope, params));
  }

  @Get('clinic/overview')
  @Can('reports.clinical.view')
  async clinicOverview(
    @Query() q: ReportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @Access() access: AccessContext,
  ) {
    const scope = await this.scopes.resolve(
      tenant,
      access,
      { perm: 'reports.clinical.view' },
      q,
    );
    const params = this.scopes.params(scope, q, 0);
    return ResponseWrapper.success(await this.clinic.overview(scope, params));
  }

  /** Financial or clinical, per report: checked in `definition()`. */
  @Get(':key')
  @AnyMember()
  async view(
    @Param('key') key: string,
    @Query() q: ReportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @Access() access: AccessContext,
  ) {
    const def = this.definition(key, access);
    const scope = await this.scopes.resolve(
      tenant,
      access,
      scopeRuleOf(def),
      q,
    );
    return ResponseWrapper.success(await this.reports.view(key, scope, q));
  }

  /** Excel / PDF download: the report's own permission plus `reports.export`. */
  @Get(':key/export')
  @RateLimit({ maxAttempts: 60, windowSeconds: 600 })
  @Can('reports.export')
  async export(
    @Param('key') key: string,
    @Query() q: ReportExportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @Access() access: AccessContext,
    @RequestActor(ActorSide.CLINIC) auditActor: ActorRef,
    @Res() res: Response,
  ) {
    const def = this.definition(key, access);
    const scope = await this.scopes.resolve(
      tenant,
      access,
      scopeRuleOf(def),
      q,
    );
    const file = await this.reports.export(key, scope, q, q.format);

    // Clinic data is leaving the system: keep a record of who took what.
    await this.audit.record(this.dataSource.manager, auditActor, {
      organizationId: tenant.organizationId,
      entityType: 'report',
      entityId: tenant.locationId,
      action: AuditAction.EXPORT,
      after: {
        report: key,
        format: q.format,
        from: q.from ?? null,
        to: q.to ?? null,
        scope: scope.label,
        rows: file.rows,
      },
    });

    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Length': String(file.buffer.length),
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Cache-Control': 'no-store',
    });
    res.end(file.buffer);
  }
}
