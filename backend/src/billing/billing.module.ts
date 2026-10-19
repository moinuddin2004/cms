import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';

// Entities — billing v2 (charge-based) + kept expenses / credit packages
import { BillingAuditLog } from './entities/billing-audit-log.entity';
import { CashClose, CashCloseLine } from './entities/cash-close.entity';
import { CatalogService } from './entities/catalog-service.entity';
import { Charge } from './entities/charge.entity';
import { CreditPackage } from './entities/credit-package.entity';
import { DiscountType } from './entities/discount-type.entity';
import { DocumentSequence } from './entities/document-sequence.entity';
import { Expense } from './entities/expense.entity';
import { Invoice } from './entities/invoice.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { LocationBillingSettings } from './entities/location-billing-settings.entity';
import { PatientCredit } from './entities/patient-credit.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAccount } from './entities/payment-account.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { Refund } from './entities/refund.entity';
import { RefundSource } from './entities/refund-source.entity';
import { ServicePrice } from './entities/service-price.entity';
import { CompensationPlan } from './commissions/entities/compensation-plan.entity';
import { CommissionRule } from './commissions/entities/commission-rule.entity';
import { CommissionEntry } from './commissions/entities/commission-entry.entity';
import { CommissionSettlement } from './commissions/entities/commission-settlement.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';

// Shared helpers (never open transactions)
import { BillingActivityService } from './activity/billing-activity.service';
import { BillingAuditService } from './audit/billing-audit.service';
import { BillingClock } from './common/billing-clock.service';
import { LedgerService } from './ledger/ledger.service';
import { DocumentSequenceService } from './numbering/document-sequence.service';
import { BillingTotalsService } from './totals/billing-totals.service';

// Domain services
import { CashCloseService } from './cash-close/cash-close.service';
import { CatalogServicesService } from './catalog/catalog.service';
import { ChargePricingService } from './catalog/charge-pricing.service';
import { ChargeSourcesService } from './charges/charge-sources.service';
import { ChargesService } from './charges/charges.service';
import { DiscountApplier } from './discounts/discount-applier.service';
import { DiscountTypesService } from './discounts/discount-types.service';
import { InvoiceEditHandlers } from './invoices/edit-operations/invoice-edit.handlers';
import { InvoiceIssuer } from './invoices/invoice-issuer.service';
import { InvoicesService } from './invoices/invoices.service';
import { BillingInvariantChecker } from './invariants/billing-invariant-checker';
import { BillingInvariantJob } from './invariants/billing-invariant.job';
import { PatientBillingService } from './patient-billing/patient-billing.service';
import { PaymentAccountsService } from './payment-accounts/payment-accounts.service';
import { AllocationWriterService } from './payments/allocation-writer.service';
import { PaymentsService } from './payments/payments.service';
import { PrintDataService } from './print/print-data.service';
import { RefundsService } from './refunds/refunds.service';
import { BillingReportsService } from './reports/billing-reports.service';
import { BillingSettingsService } from './settings/billing-settings.service';
import { CreditPackagesService } from './credit-packages.service';
import { ExpensesService } from './expenses.service';
import { FinancialSummaryService } from './financial-summary.service';
import { PatientCreditsService } from './patient-credits.service';
import { CompensationPlansService } from './commissions/compensation-plans.service';
import { CommissionService } from './commissions/commission.service';
import { CommissionReportsService } from './commissions/commission-reports.service';

// Controllers
import { ChargesController } from './charges/charges.controller';
import {
  CreditPackagesController,
  PatientCreditsController,
} from './credit-packages.controller';
import { ExpensesController } from './expenses.controller';
import { FinancialSummaryController } from './financial-summary.controller';
import { InvoicesController } from './invoices/invoices.controller';
import { BillingReportsController } from './patient-billing/billing-reports.controller';
import { PaymentsController } from './payments/payments.controller';
import { PrintDataController } from './print/print-data.controller';
import { BillingConfigController } from './settings/billing-config.controller';
import { CompensationPlansController } from './commissions/compensation-plans.controller';
import { CommissionsController } from './commissions/commissions.controller';

/**
 * Billing v2: charge-based billing (D1). Money writes go through the
 * orchestrating services (collect, edit, refund…) which open ONE
 * transaction and call the helper services with its EntityManager.
 * `ChargeSourcesService` is exported for the queue's completion hook.
 */
@Module({
  imports: [
    CommonModule,
    FeatureFlagsModule,
    TypeOrmModule.forFeature([
      BillingAuditLog,
      CashClose,
      CashCloseLine,
      CatalogService,
      Charge,
      CreditPackage,
      DiscountType,
      DocumentSequence,
      Expense,
      Invoice,
      LedgerEntry,
      LocationBillingSettings,
      PatientCredit,
      Payment,
      PaymentAccount,
      PaymentAllocation,
      Refund,
      RefundSource,
      ServicePrice,
      CompensationPlan,
      CommissionRule,
      CommissionEntry,
      CommissionSettlement,
      EmployeeOrgLocationAssignment,
    ]),
  ],
  controllers: [
    BillingConfigController,
    ChargesController,
    InvoicesController,
    PaymentsController,
    BillingReportsController,
    PrintDataController,
    ExpensesController,
    FinancialSummaryController,
    CreditPackagesController,
    PatientCreditsController,
    CompensationPlansController,
    CommissionsController,
  ],
  providers: [
    BillingClock,
    BillingAuditService,
    LedgerService,
    DocumentSequenceService,
    BillingTotalsService,
    BillingInvariantChecker,
    BillingInvariantJob,
    BillingSettingsService,
    PaymentAccountsService,
    ChargePricingService,
    CatalogServicesService,
    DiscountTypesService,
    DiscountApplier,
    ChargesService,
    ChargeSourcesService,
    InvoiceIssuer,
    InvoiceEditHandlers,
    InvoicesService,
    AllocationWriterService,
    PaymentsService,
    RefundsService,
    PatientBillingService,
    CashCloseService,
    BillingReportsService,
    BillingActivityService,
    PrintDataService,
    ExpensesService,
    CreditPackagesService,
    PatientCreditsService,
    FinancialSummaryService,
    CompensationPlansService,
    CommissionService,
    CommissionReportsService,
  ],
  exports: [ChargeSourcesService],
})
export class BillingModule {}
