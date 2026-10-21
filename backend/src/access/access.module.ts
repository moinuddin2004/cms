import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { AccessVersionModule } from './version/access-version.module';
import { AccessResolver } from './access.resolver';
import { AccessGuard } from './access.guard';
import { AccessTemplatesService } from './templates/access-templates.service';
import {
  AccessCatalogController,
  MeAccessController,
} from './access.controller';
import { VisibleIfInterceptor } from './visible-if/visible-if';

/**
 * Access core: permission catalog, AccessResolver (+ cache), AccessGuard,
 * `@Can` / `@AnyMember` / `@Access()`, `@VisibleIf`, role templates,
 * `GET /me/access` and `GET /access/catalog`. Global so every module can
 * inject AccessResolver / AccessTemplatesService without importing it.
 *
 * AccessGuard itself is registered as APP_GUARD in AppModule (after the
 * legacy guards, so the order is explicit there).
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      OrganizationOwnership,
      EmploymentRole,
      EmployeeOrgLocationAssignment,
      // for AuthorizationService (/me/access membership check)
      Location,
      Employee,
    ]),
    AccessVersionModule,
    FeatureFlagsModule,
  ],
  controllers: [MeAccessController, AccessCatalogController],
  providers: [
    AccessResolver,
    AccessGuard,
    AccessTemplatesService,
    AuthorizationService,
    { provide: APP_INTERCEPTOR, useClass: VisibleIfInterceptor },
  ],
  exports: [AccessResolver, AccessGuard, AccessTemplatesService],
})
export class AccessModule {}
