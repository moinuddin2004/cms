import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import {
  LabBillingSettings,
  LabCreditNote,
  LabRefund,
  LabRefundSource,
} from './entities/lab-credit.entity';
import { LabInvoice, LabInvoiceLine } from './entities/lab-invoice.entity';
import {
  LabPayment,
  LabPaymentAllocation,
} from './entities/lab-payment.entity';
import { LabBillingEvents } from './events/lab-billing-events';
import { LabBillingController } from './lab-billing.controller';
import { LabPatientNotifier } from './notifications/patient-notifier.service';
import { LabAllocations } from './services/lab-allocations.service';
import { LabBillingQueries } from './services/lab-billing-queries.service';
import { LabBillingTotals } from './services/lab-billing-totals.service';
import { LabCreditsService } from './services/lab-credits.service';
import { LabInvoicesService } from './services/lab-invoices.service';
import { LabPaymentsService } from './services/lab-payments.service';

/**
 * Lab management — Sprint 9, patient billing for lab work + patient
 * notifications (lab ERD §6a, §10, §15, §16). Billing v2's pattern (patient-
 * owned payments with advance, allocations, a single totals writer, row
 * locks, idempotent collects) on the lab's own tables. Sprint 10 plugs the
 * ledger and commissions in through `LabBillingEvents`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabInvoice,
      LabInvoiceLine,
      LabPayment,
      LabPaymentAllocation,
      LabCreditNote,
      LabRefund,
      LabRefundSource,
      LabBillingSettings,
    ]),
    LabOrdersModule,
    NotificationsModule,
  ],
  controllers: [LabBillingController],
  providers: [
    LabBillingEvents,
    LabBillingTotals,
    LabAllocations,
    LabPatientNotifier,
    LabInvoicesService,
    LabPaymentsService,
    LabCreditsService,
    LabBillingQueries,
  ],
  exports: [LabBillingEvents, LabBillingQueries],
})
export class LabBillingModule {}
