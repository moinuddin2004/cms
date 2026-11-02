import { Module } from '@nestjs/common';
import { BillingModule } from 'src/billing/billing.module';
import { TreatmentPlansController } from './treatment-plans.controller';
import { TreatmentPlansService } from './treatment-plans.service';

@Module({
  imports: [BillingModule],
  controllers: [TreatmentPlansController],
  providers: [TreatmentPlansService],
})
export class TreatmentPlansModule {}
