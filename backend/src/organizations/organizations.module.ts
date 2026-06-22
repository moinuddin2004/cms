import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationOwnership } from './entities/organization-ownership.entity';
import { OrganizationSettings } from './entities/organization-settings.entity';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationOwnership,
      OrganizationSettings,
    ]),
    FeatureFlagsModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
