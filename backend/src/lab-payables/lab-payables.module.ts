import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneralLedgerModule } from 'src/billing/ledger/journal/general-ledger.module';
import { EngineModule } from 'src/engine/engine.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { LabsModule } from 'src/labs/labs.module';
import { LabPayablesController } from './controllers/lab-payables.controller';
import { LabPortalPayablesController } from './controllers/lab-portal-payables.controller';
import {
  LabStatement,
  LabStatementLine,
} from './entities/lab-statement.entity';
import { VendorBill, VendorBillLine } from './entities/vendor-bill.entity';
import {
  VendorPayment,
  VendorPaymentAllocation,
} from './entities/vendor-payment.entity';
import { BillDraftsService } from './services/bill-drafts.service';
import { LabPortalPayablesService } from './services/lab-portal-payables.service';
import { LabStatementsService } from './services/lab-statements.service';
import {
  LabCaseCostService,
  PayablesReportsService,
} from './services/payables-reports.service';
import { VendorBillsService } from './services/vendor-bills.service';
import { VendorPaymentsService } from './services/vendor-payments.service';
import { CreateVendorBillDraftEffect } from './workflow/vendor-bill-draft.effect';

/**
 * Lab management — Sprint 10, lab payables (lab ERD §6b, §6c, §10 "Vendor
 * bill approve", §15): per-order draft vendor bills from the accept effect
 * `create_vendor_bill_draft`, approval into billing's double-entry
 * journals, lab payments with allocations, monthly statement
 * reconciliation, payables reports and the lab's read-only portal view.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      VendorBill,
      VendorBillLine,
      VendorPayment,
      VendorPaymentAllocation,
      LabStatement,
      LabStatementLine,
    ]),
    GeneralLedgerModule,
    EngineModule,
    LabsModule,
    LabOrdersModule,
  ],
  controllers: [LabPayablesController, LabPortalPayablesController],
  providers: [
    BillDraftsService,
    CreateVendorBillDraftEffect,
    VendorBillsService,
    VendorPaymentsService,
    LabStatementsService,
    PayablesReportsService,
    LabCaseCostService,
    LabPortalPayablesService,
  ],
  exports: [LabCaseCostService, BillDraftsService],
})
export class LabPayablesModule {}
