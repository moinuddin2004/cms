import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';

// Entities
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { Coupon } from './entities/coupon.entity';
import { Expense } from './entities/expense.entity';
import { CreditPackage } from './entities/credit-package.entity';
import { PatientCredit } from './entities/patient-credit.entity';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

// Services
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { CouponsService } from './coupons.service';
import { ExpensesService } from './expenses.service';
import { CreditPackagesService } from './credit-packages.service';
import { PatientCreditsService } from './patient-credits.service';
import { FinancialSummaryService } from './financial-summary.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { PaymentGatewayService } from './payment-gateway.service';

// Controllers
import { InvoicesController } from './invoices.controller';
import { CouponsController } from './coupons.controller';
import { ExpensesController } from './expenses.controller';
import {
  CreditPackagesController,
  PatientCreditsController,
} from './credit-packages.controller';
import { FinancialSummaryController } from './financial-summary.controller';

@Module({
  imports: [
    CommonModule,
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Payment,
      Coupon,
      Expense,
      CreditPackage,
      PatientCredit,
      PatientTreatmentPlan,
      Organization,
    ]),
  ],
  controllers: [
    InvoicesController,
    CouponsController,
    ExpensesController,
    CreditPackagesController,
    PatientCreditsController,
    FinancialSummaryController,
  ],
  providers: [
    InvoicesService,
    PaymentsService,
    CouponsService,
    ExpensesService,
    CreditPackagesService,
    PatientCreditsService,
    FinancialSummaryService,
    ReceiptPdfService,
    PaymentGatewayService,
  ],
  exports: [InvoicesService, PaymentsService],
})
export class BillingModule {}
