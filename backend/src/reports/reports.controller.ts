import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { AuditService } from 'src/common/audit/audit.service';
import { ActorRef, ActorSide, AuditAction } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { ClinicOverviewService } from './clinic/clinic-overview.service';
import { ReportExportQueryDto, ReportQueryDto } from './core/report-query.dto';
import { ReportScopeService } from './core/report-scope.service';
import { FinanceOverviewService } from './finance/finance-overview.service';
import {
  REPORTS_CLINICAL_FEATURE,
  REPORTS_EXPORT_FEATURE,
  REPORTS_FEATURE,
} from './reports.constants';
import { featureOf, ReportsService } from './reports.service';

/**
 * Owner / admin reports and the two dashboards. Financial reports need
 * `reports.financial`, clinical / operational ones `reports.clinical`;
 * downloads also need `reports.exports`. Every report is admin-only.
 */
@Controller('reports')
@Roles(AppRole.CLINIC_ADMIN)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly scopes: ReportScopeService,
    private readonly finance: FinanceOverviewService,
    private readonly clinic: ClinicOverviewService,
    private readonly features: FeatureFlagsService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Enabled report features of the org; `null` = all (super admin, like FeatureFlagGuard). */
  private async enabled(
    tenant: TenantContext,
    userId: string,
  ): Promise<Set<string> | null> {
    if (await this.authorization.isSuperAdmin(userId)) return null;
    return this.features.getEnabledFeatures(tenant.organizationId);
  }

  private async assertReport(
    key: string,
    tenant: TenantContext,
    userId: string,
  ) {
    const feature = featureOf(this.reports.definition(key));
    const enabled = await this.enabled(tenant, userId);
    if (enabled && !enabled.has(feature)) {
      throw new ForbiddenException(
        'This report is not enabled for this organization.',
      );
    }
  }

  @Get()
  async catalog(
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
  ) {
    return ResponseWrapper.success(
      this.reports.catalog(await this.enabled(tenant, actor.userId)),
    );
  }

  @Get('finance/overview')
  @RequireFeature(REPORTS_FEATURE)
  async financeOverview(
    @Query() q: ReportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
  ) {
    const scope = await this.scopes.resolve(tenant, actor.userId, q);
    const params = this.scopes.params(scope, q, 0);
    return ResponseWrapper.success(await this.finance.overview(scope, params));
  }

  @Get('clinic/overview')
  @RequireFeature(REPORTS_CLINICAL_FEATURE)
  async clinicOverview(
    @Query() q: ReportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
  ) {
    const scope = await this.scopes.resolve(tenant, actor.userId, q);
    const params = this.scopes.params(scope, q, 0);
    return ResponseWrapper.success(await this.clinic.overview(scope, params));
  }

  @Get(':key')
  async view(
    @Param('key') key: string,
    @Query() q: ReportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
  ) {
    await this.assertReport(key, tenant, actor.userId);
    const scope = await this.scopes.resolve(tenant, actor.userId, q);
    return ResponseWrapper.success(await this.reports.view(key, scope, q));
  }

  /** Excel / PDF download: the report's own feature plus `reports.exports`. */
  @Get(':key/export')
  @RequireFeature(REPORTS_EXPORT_FEATURE)
  async export(
    @Param('key') key: string,
    @Query() q: ReportExportQueryDto,
    @ActiveTenant() tenant: TenantContext,
    @CurrentActor() actor: Actor,
    @RequestActor(ActorSide.CLINIC) auditActor: ActorRef,
    @Res() res: Response,
  ) {
    await this.assertReport(key, tenant, actor.userId);
    const scope = await this.scopes.resolve(tenant, actor.userId, q);
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
