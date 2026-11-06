import { NotificationsModule } from 'src/notifications/notifications.module';
import { SubscriptionRemindersJob } from './subscription-reminders.job';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { SubscriptionsService } from './subscriptions.service';
import { ClinicSetupService } from './clinic-setup.service';
import { SubscriptionGuard } from './subscription.guard';
import { AccountController } from './account.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';

/**
 * Clinic subscriptions (plans, trial, manual payments, limits) and
 * self-serve clinic signup + setup. Imports neither Auth, Locations nor
 * Users so those modules can import this one for the limit checks.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPayment]),
    CommonModule,
    FeatureFlagsModule,
    NotificationsModule,
  ],
  controllers: [AccountController, AdminSubscriptionsController],
  providers: [
    SubscriptionsService,
    ClinicSetupService,
    SubscriptionGuard,
    SubscriptionRemindersJob,
  ],
  exports: [SubscriptionsService, ClinicSetupService, SubscriptionGuard],
})
export class SubscriptionsModule {}
