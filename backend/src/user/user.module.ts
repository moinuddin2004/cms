import { ClinicAccessModule } from 'src/clinic-access/clinic-access.module';
import { StorageModule } from 'src/common/storage/storage.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CommonModule } from 'src/common/common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { SecurityLog } from 'src/auth/entities/SecurityLog';
import { EmailVerificationService } from './email-verification.service';
import { SessionModule } from 'src/session/session.module';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';

@Module({
  imports: [
    StorageModule,
    CommonModule,
    TypeOrmModule.forFeature([User, SecurityLog]),
    SessionModule,
    SubscriptionsModule,
    NotificationsModule,
    ClinicAccessModule,
  ],
  providers: [UserService, EmailVerificationService],
  controllers: [UserController],
  exports: [UserService, EmailVerificationService, TypeOrmModule],
})
export class UserModule {}
