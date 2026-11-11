import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAccount } from 'src/patient-auth/entities/patient-account.entity';
import { PatientAccessLog } from './entities/patient-access-log.entity';
import { PatientAccountConsent } from './entities/patient-account-consent.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { PatientRecordLink } from './entities/patient-record-link.entity';
import { PatientMeController } from './me.controller';
import { PatientMeService } from './patient-me.service';

/** Patient-space API: `/patient-api/me` (M2-02); more routes in later cards. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientAccount,
      PatientProfile,
      PatientRecordLink,
      PatientAccountConsent,
      PatientAccessLog,
    ]),
  ],
  controllers: [PatientMeController],
  providers: [PatientMeService],
  exports: [TypeOrmModule],
})
export class PatientAppModule {}
