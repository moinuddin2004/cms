import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAccessLog } from './entities/patient-access-log.entity';
import { PatientAccountConsent } from './entities/patient-account-consent.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { PatientRecordLink } from './entities/patient-record-link.entity';

/** Patient-space tables (M2-01). Entities only; the patient API arrives in later cards. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientProfile,
      PatientRecordLink,
      PatientAccountConsent,
      PatientAccessLog,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class PatientAppModule {}
