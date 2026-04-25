import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtTokenService } from './jwt.service';
import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.stategy';
import { CommonModule } from 'src/common/common.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SecurityLogService } from './security-log.service';
import { SecurityLog } from './entities/SecurityLog';
import { OAuthProvider } from './entities/OAuthProvider';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { Reflector } from '@nestjs/core';
import { SessionModule } from 'src/session/session.module';
import { AuthorizationService } from './services/authorization.service';

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
    SessionModule,
  ],
  providers: [
    AuthService,
    AuthorizationService,
    JwtTokenService,
    UserService,
    NestJwtService,
    ConfigService,
    GoogleStrategy,
    GithubStrategy,
    JwtStrategy,
    SecurityLogService,
    RateLimiterGuard,
    Reflector,
  ],
  exports: [JwtStrategy, SecurityLogService, AuthorizationService],
  controllers: [AuthController],
})
export class AuthModule {}
