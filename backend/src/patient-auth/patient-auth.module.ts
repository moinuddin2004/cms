import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { PatientAccountConsent } from 'src/patient-app/entities/patient-account-consent.entity';
import { PatientAccountIdentity } from './entities/patient-account-identity.entity';
import { PatientAccount } from './entities/patient-account.entity';
import { PatientLoginCode } from './entities/patient-login-code.entity';
import { PatientSession } from './entities/patient-session.entity';
import { LoginCodeService } from './login-code.service';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';
import {
  assertPatientSecret,
  PATIENT_ACCESS_SECRET,
  PATIENT_CODE_PEPPER,
  resolveCodePepper,
} from './patient-config';
import { PatientSessionService } from './patient-session.service';
import { PatientTokenService } from './patient-token.service';
import { PatientJwtStrategy } from './strategies/patient-jwt.strategy';

/**
 * Patient sign-in (M2-02): emailed code, sessions with rotation + reuse
 * detection, patient JWT strategy. Boot fails when `JWT_PATIENT_ACCESS_SECRET`
 * is missing or equal to the staff secret.
 */
@Module({
  imports: [
    CommonModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      PatientAccount,
      PatientAccountIdentity,
      PatientSession,
      PatientLoginCode,
      PatientAccountConsent,
    ]),
  ],
  controllers: [PatientAuthController],
  providers: [
    {
      provide: PATIENT_ACCESS_SECRET,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => assertPatientSecret(config),
    },
    {
      provide: PATIENT_CODE_PEPPER,
      inject: [ConfigService, PATIENT_ACCESS_SECRET],
      useFactory: (config: ConfigService, secret: string) =>
        resolveCodePepper(config, secret),
    },
    LoginCodeService,
    PatientSessionService,
    PatientTokenService,
    PatientAuthService,
    PatientJwtStrategy,
  ],
  exports: [TypeOrmModule, PatientSessionService, PatientTokenService],
})
export class PatientAuthModule {}
