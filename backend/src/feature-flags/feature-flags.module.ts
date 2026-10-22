import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureCatalog } from './entities/feature-catalog.entity';
import { OrgFeatureFlag } from './entities/org-feature-flag.entity';
import { LocationFeatureOverride } from './entities/location-feature-override.entity';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureAdminService } from './feature-admin.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { AdminFeaturesController } from './admin-features.controller';
import { CommonModule } from 'src/common/common.module';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeatureCatalog,
      OrgFeatureFlag,
      LocationFeatureOverride,
      // for the impact list (roles that lose permissions)
      EmploymentRole,
      // for AuthorizationService (my-features membership check)
      User,
      Organization,
      OrganizationOwnership,
      Location,
      Employee,
      EmployeeOrgLocationAssignment,
    ]),
    CommonModule,
  ],
  controllers: [FeatureFlagsController, AdminFeaturesController],
  providers: [FeatureFlagsService, FeatureAdminService, AuthorizationService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
