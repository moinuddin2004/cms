import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureCatalog } from './entities/feature-catalog.entity';
import { OrgFeatureFlag } from './entities/org-feature-flag.entity';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { CommonModule } from 'src/common/common.module';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeatureCatalog,
      OrgFeatureFlag,
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
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, AuthorizationService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
