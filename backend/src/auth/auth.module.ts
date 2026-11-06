import { NotificationsModule } from 'src/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtTokenService } from './jwt.service';
import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { CommonModule } from 'src/common/common.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SecurityLogService } from './security-log.service';
import { SecurityLog } from './entities/SecurityLog';
import { OAuthProvider } from './entities/OAuthProvider';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { Reflector } from '@nestjs/core';
import { SessionModule } from 'src/session/session.module';
import { SubscriptionsModule } from 'src/subscriptions/subscriptions.module';
import { AuthorizationService } from './services/authorization.service';
import { ClinicAccessModule } from 'src/clinic-access/clinic-access.module';
import { GoogleIdentityService } from './google/google-identity.service';
import { GoogleAuthService } from './google/google-auth.service';
import { GoogleAuthController } from './google/google-auth.controller';

// Entities needed by AuthorizationService
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SecurityLog,
      OAuthProvider,
      OrganizationOwnership,
      Organization,
      Location,
      Employee,
      EmployeeOrgLocationAssignment,
    ]),
    UserModule,
    CommonModule,
    NotificationsModule,
    SessionModule,
    SubscriptionsModule,
    ClinicAccessModule,
  ],
  providers: [
    AuthService,
    AuthorizationService,
    JwtTokenService,
    UserService,
    NestJwtService,
    ConfigService,
    // Google sign-in: ID token from Google Identity Services, no passport.
    GoogleIdentityService,
    GoogleAuthService,
    JwtStrategy,
    SecurityLogService,
    RateLimiterGuard,
    Reflector,
  ],
  exports: [JwtStrategy, SecurityLogService, AuthorizationService],
  controllers: [AuthController, GoogleAuthController],
})
export class AuthModule {}
