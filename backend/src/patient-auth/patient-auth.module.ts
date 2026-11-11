import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAccountIdentity } from './entities/patient-account-identity.entity';
import { PatientAccount } from './entities/patient-account.entity';
import { PatientLoginCode } from './entities/patient-login-code.entity';
import { PatientSession } from './entities/patient-session.entity';

/** Patient identity tables (M2-01). Entities only; services and controllers arrive with M2-02. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientAccount,
      PatientAccountIdentity,
      PatientSession,
      PatientLoginCode,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class PatientAuthModule {}
