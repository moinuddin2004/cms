import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { PatientAccount } from 'src/patient-auth/entities/patient-account.entity';
import { PrescriptionsModule } from 'src/prescriptions/prescriptions.module';
import { PatientAccessLog } from './entities/patient-access-log.entity';
import { PatientAccountConsent } from './entities/patient-account-consent.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { PatientRecordLink } from './entities/patient-record-link.entity';
import { MedicationsModule } from 'src/medications/medications.module';
import { PatientMedicationsController } from './medications/patient-medications.controller';
import { PatientMedicationsService } from './medications/patient-medications.service';
import { PatientLinksModule } from 'src/patient-links/patient-links.module';
import { ClaimsController } from './claims.controller';
import { PatientAccountService } from './account/patient-account.service';
import { PatientAccountLinksController } from './links/patient-links.controller';
import { PatientAccountLinksService } from './links/patient-account-links.service';
import { PatientProfilesController } from './profiles/patient-profiles.controller';
import { PatientProfilesService } from './profiles/patient-profiles.service';
import { PatientJwtGuard } from './guards/patient-jwt.guard';
import { PatientLinkGuard } from './guards/patient-link.guard';
import { PatientMeController } from './me.controller';
import { PatientMeService } from './patient-me.service';
import { PatientAccessLogService } from './reads/patient-access-log.service';
import { PatientClinicsService } from './reads/patient-clinics.service';
import { PatientReadsController } from './reads/patient-reads.controller';
import { PatientReadsService } from './reads/patient-reads.service';
import './patient-app.settings';

/** Patient-space API: `/patient-api/me` (M2-02, delete M2-11), claims (M2-04), reads (M2-08), medications (M3-02), profiles (M2-10), links (M2-11). */
@Module({
  imports: [
    FeatureFlagsModule,
    PrescriptionsModule,
    PatientLinksModule,
    MedicationsModule,
    TypeOrmModule.forFeature([
      PatientAccount,
      PatientProfile,
      PatientRecordLink,
      PatientAccountConsent,
      PatientAccessLog,
    ]),
  ],
  controllers: [
    PatientMeController,
    PatientReadsController,
    PatientMedicationsController,
    ClaimsController,
    PatientProfilesController,
    PatientAccountLinksController,
  ],
  providers: [
    PatientMeService,
    PatientAccountService,
    PatientAccountLinksService,
    PatientProfilesService,
    PatientJwtGuard,
    PatientLinkGuard,
    PatientClinicsService,
    PatientAccessLogService,
    PatientReadsService,
    PatientMedicationsService,
  ],
  exports: [TypeOrmModule, PatientJwtGuard, PatientLinkGuard],
})
export class PatientAppModule {}
