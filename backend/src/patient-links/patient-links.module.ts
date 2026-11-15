import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { Organization } from 'src/organizations/entities/organization.entity';
import { PatientAccessLog } from 'src/patient-app/entities/patient-access-log.entity';
import { PatientRecordLink } from 'src/patient-app/entities/patient-record-link.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { PatientClaimToken } from './entities/patient-claim-token.entity';
import { ClaimEligibilityService } from './claim-eligibility.service';
import { ClaimsService } from './claims.service';
import { PatientLinksController } from './patient-links.controller';
import { PatientLinksService } from './patient-links.service';

/**
 * Patient app link (M2-04): staff claim-token / status / revoke endpoints and
 * the claim service the patient API (`/patient-api/claims/*`, in
 * `PatientAppModule`) calls.
 */
@Module({
  imports: [
    FeatureFlagsModule,
    TypeOrmModule.forFeature([
      PatientClaimToken,
      PatientRecordLink,
      PatientAccessLog,
      Patient,
      Organization,
    ]),
  ],
  controllers: [PatientLinksController],
  providers: [PatientLinksService, ClaimsService, ClaimEligibilityService],
  exports: [TypeOrmModule, ClaimsService],
})
export class PatientLinksModule {}
