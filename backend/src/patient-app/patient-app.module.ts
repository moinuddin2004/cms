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
import { PatientJwtGuard } from './guards/patient-jwt.guard';
import { PatientLinkGuard } from './guards/patient-link.guard';
import { PatientMeController } from './me.controller';
import { PatientMeService } from './patient-me.service';
import { PatientAccessLogService } from './reads/patient-access-log.service';
import { PatientClinicsService } from './reads/patient-clinics.service';
import { PatientReadsController } from './reads/patient-reads.controller';
import { PatientReadsService } from './reads/patient-reads.service';
import './patient-app.settings';

/** Patient-space API: `/patient-api/me` (M2-02), `/patient-api/claims` (M2-04), record reads (M2-08), medications (M3-02). */
@Module({
  imports: [
    FeatureFlagsModule,
    PrescriptionsModule,
    PatientLinksModule,
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
  ],
  providers: [
    PatientMeService,
    PatientJwtGuard,
    PatientLinkGuard,
    PatientClinicsService,
    PatientAccessLogService,
    PatientReadsService,
  ],
  exports: [TypeOrmModule, PatientJwtGuard, PatientLinkGuard],
})
export class PatientAppModule {}
