import { Module } from '@nestjs/common';
import { GeneralLedgerModule } from 'src/billing/ledger/journal/general-ledger.module';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { LabBillingModule } from 'src/lab-billing/lab-billing.module';
import { LabPayablesModule } from 'src/lab-payables/lab-payables.module';
import { LabCommissionService } from './lab-commission.service';
import { LabFinanceListeners } from './lab-finance.listeners';
import { LabReceivablesLedger } from './lab-receivables-ledger.service';

/**
 * Lab management — Sprint 11: the money glue between lab patient billing
 * (Sprint 9), lab payables (Sprint 10), billing v2's doctor commission
 * ledger and the double-entry journals. Lab ERD §6c, §10, §15.
 */
@Module({
  imports: [
    GeneralLedgerModule,
    FeatureFlagsModule,
    LabBillingModule,
    LabPayablesModule,
  ],
  providers: [LabCommissionService, LabReceivablesLedger, LabFinanceListeners],
  exports: [LabCommissionService],
})
export class LabFinanceModule {}
