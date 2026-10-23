import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { localDate, localHHMM } from 'src/common/clock/tz.util';
import { displayDate } from './core/report-dates';
import { rowToRupees, summaryToRupees, totalsOf } from './core/report-format';
import type { ExportFormat, ReportQueryDto } from './core/report-query.dto';
import type { AccessContext } from 'src/access/access-context';
import type { Permission } from 'src/access/catalog/permissions';
import {
  type ReportScopeRule,
  ReportScopeService,
} from './core/report-scope.service';
import type {
  ReportDefinition,
  ReportScope,
  ReportView,
} from './core/report.types';
import { clinicalReports } from './definitions/clinical.reports';
import { costReports } from './definitions/cost.reports';
import { patientReports } from './definitions/patient.reports';
import { visitReports } from './definitions/visit.reports';
import { financeReports } from './definitions/finance.reports';
import { revenueReports } from './definitions/revenue.reports';
import { exportPdf, MAX_PDF_ROWS } from './exporters/pdf.exporter';
import { exportXlsx } from './exporters/xlsx.exporter';
import { FinanceOverviewService } from './finance/finance-overview.service';
import { REPORTS_CLINICAL_FEATURE, REPORTS_FEATURE } from './reports.constants';

/** The feature flag a report is gated by. */
export const featureOf = (d: ReportDefinition) => d.feature ?? REPORTS_FEATURE;

/** The permission a report is gated by (it implies the report's feature). */
export const permissionOf = (d: ReportDefinition): Permission =>
  featureOf(d) === REPORTS_CLINICAL_FEATURE
    ? 'reports.clinical.view'
    : 'reports.financial.view';

/** How far `access` may run report `d` (see ReportScopeService). */
export const scopeRuleOf = (d: ReportDefinition): ReportScopeRule => ({
  perm: permissionOf(d),
  doctorFilter: !!d.filters.doctor,
});

/** Rows a report returns to the screen / puts in a file before truncating. */
const MAX_VIEW_ROWS = 5000;
const MAX_EXPORT_ROWS = 50_000;

const CONTENT_TYPE: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/** Report registry + engine: run a definition, shape it, export it. */
@Injectable()
export class ReportsService {
  private readonly definitions: ReportDefinition[];
  private readonly byKey: Map<string, ReportDefinition>;

  constructor(
    @InjectDataSource() dataSource: DataSource,
    finance: FinanceOverviewService,
    private readonly scopes: ReportScopeService,
  ) {
    this.definitions = [
      ...financeReports(dataSource, finance),
      ...revenueReports(dataSource),
      ...costReports(dataSource),
      ...patientReports(dataSource),
      ...visitReports(dataSource),
      ...clinicalReports(dataSource),
    ];
    this.byKey = new Map(this.definitions.map((d) => [d.key, d]));
  }

  /**
   * Reports this caller can run: they hold the report's permission (which
   * also means its feature is on), and an `own`-scoped grant only lists
   * reports that can be narrowed to one doctor.
   */
  catalog(access: AccessContext) {
    return this.definitions
      .filter((d) => {
        const reach = access.scope(permissionOf(d));
        return !!reach && (reach !== 'own' || !!d.filters.doctor);
      })
      .map((d) => ({
        key: d.key,
        title: d.title,
        description: d.description,
        category: d.category,
        filters: d.filters,
        permission: permissionOf(d),
      }));
  }

  definition(key: string): ReportDefinition {
    const def = this.byKey.get(key);
    if (!def) throw new NotFoundException('Report not found');
    return def;
  }

  async view(
    key: string,
    scope: ReportScope,
    q: ReportQueryDto,
    mode: 'view' | 'export' = 'view',
  ): Promise<ReportView> {
    const def = this.definition(key);
    const cap = mode === 'view' ? MAX_VIEW_ROWS : MAX_EXPORT_ROWS;
    const asOf = def.filters.dates === 'asOf';
    const params = this.scopes.params(
      scope,
      asOf ? { ...q, from: scope.today, to: scope.today } : q,
      cap + 1,
    );
    const result = await def.run(scope, params);
    const truncated = result.rows.length > cap;
    const rows = truncated ? result.rows.slice(0, cap) : result.rows;
    const totals =
      result.totals === undefined ? totalsOf(rows, def.columns) : result.totals;
    const now = new Date();

    return {
      key: def.key,
      title: def.title,
      description: def.description,
      columns: def.columns,
      rows: rows.map((r) => rowToRupees(r, def.columns)),
      totals: totals ? rowToRupees(totals, def.columns) : null,
      summary: summaryToRupees(result.summary ?? []),
      notes: [
        ...(truncated ? ['Totals cover only the rows shown.'] : []),
        ...(result.notes ?? []),
      ],
      truncated,
      totalRows: rows.length,
      meta: {
        organizationName: scope.organizationName,
        scopeLabel: scope.label,
        from: params.from,
        to: params.to,
        asOf,
        basis: params.basis,
        generatedAt: now.toISOString(),
        generatedLabel: `${displayDate(localDate(scope.tz, now))}, ${localHHMM(scope.tz, now)}`,
      },
    };
  }

  async export(
    key: string,
    scope: ReportScope,
    q: ReportQueryDto,
    format: ExportFormat,
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    contentType: string;
    rows: number;
  }> {
    const view = await this.view(key, scope, q, 'export');
    if (format === 'pdf' && view.rows.length > MAX_PDF_ROWS) {
      throw new BadRequestException(
        `This report has ${view.rows.length} rows — too many for a PDF (max ${MAX_PDF_ROWS}). Download Excel or pick a shorter period.`,
      );
    }
    const buffer =
      format === 'xlsx'
        ? await exportXlsx(view)
        : await exportPdf(view, this.definition(key).landscape ?? false);
    const period = view.meta.asOf
      ? view.meta.to
      : `${view.meta.from}_to_${view.meta.to}`;
    return {
      buffer,
      fileName: `${key}_${period}.${format}`,
      contentType: CONTENT_TYPE[format],
      rows: view.rows.length,
    };
  }
}
