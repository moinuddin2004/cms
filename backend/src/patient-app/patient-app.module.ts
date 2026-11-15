import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { PatientAccount } from 'src/patient-auth/entities/patient-account.entity';
import { PatientAccessLog } from './entities/patient-access-log.entity';
import { PatientAccountConsent } from './entities/patient-account-consent.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { PatientRecordLink } from './entities/patient-record-link.entity';
import { PatientLinksModule } from 'src/patient-links/patient-links.module';
import { ClaimsController } from './claims.controller';
import { PatientJwtGuard } from './guards/patient-jwt.guard';
import { PatientLinkGuard } from './guards/patient-link.guard';
import { PatientMeController } from './me.controller';
import { PatientMeService } from './patient-me.service';
import './patient-app.settings';

/** Patient-space API: `/patient-api/me` (M2-02), `/patient-api/claims` (M2-04); more routes in later cards. */
@Module({
  imports: [
    FeatureFlagsModule,
    PatientLinksModule,
    TypeOrmModule.forFeature([
      PatientAccount,
      PatientProfile,
      PatientRecordLink,
      PatientAccountConsent,
      PatientAccessLog,
    ]),
  ],
  controllers: [PatientMeController, ClaimsController],
  providers: [PatientMeService, PatientJwtGuard, PatientLinkGuard],
  exports: [TypeOrmModule, PatientJwtGuard, PatientLinkGuard],
})
export class PatientAppModule {}
