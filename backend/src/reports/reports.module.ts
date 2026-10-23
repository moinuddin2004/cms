import { Module } from '@nestjs/common';
import { ClinicOverviewService } from './clinic/clinic-overview.service';
import { ReportScopeService } from './core/report-scope.service';
import { FinanceDataService } from './finance/finance-data.service';
import { FinanceOverviewService } from './finance/finance-overview.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Read-only reporting over billing v2, lab billing, lab payables, payroll,
 * commissions and expenses: a report registry with Excel / PDF export and
 * the owner's finance dashboard. Owns no tables.
 */
@Module({
  controllers: [ReportsController],
  providers: [
    ReportScopeService,
    FinanceDataService,
    FinanceOverviewService,
    ClinicOverviewService,
    ReportsService,
  ],
})
export class ReportsModule {}
