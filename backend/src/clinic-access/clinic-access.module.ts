import { NotificationsModule } from 'src/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { EmployeesModule } from 'src/employees/employees.module';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';
import './sign-in-policy.settings'; // registers the auth.* keys
import { ClinicJoinRequest } from './entities/clinic-join-request.entity';
import { ClinicInvite } from './entities/clinic-invite.entity';
import { ClinicGateService } from './clinic-gate.service';
import { ClinicAccessService } from './clinic-access.service';
import {
  ClinicApprovalController,
  JoinInvitesController,
  JoinRequestsController,
  PublicInviteController,
  SignInPolicyController,
} from './clinic-access.controller';

/**
 * Who may use a clinic: super admin approval of self-signup clinics, the
 * clinic's sign-in policy (Google only / allowed Workspace domains) and
 * Google join requests. Imports no Auth module, so Auth can import this.
 */
@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([ClinicJoinRequest, ClinicInvite]),
    CommonModule,
    EmployeesModule,
    SubscriptionsModule,
  ],
  controllers: [
    ClinicApprovalController,
    SignInPolicyController,
    JoinRequestsController,
    JoinInvitesController,
    PublicInviteController,
  ],
  providers: [ClinicGateService, ClinicAccessService],
  exports: [ClinicGateService, ClinicAccessService],
})
export class ClinicAccessModule {}
