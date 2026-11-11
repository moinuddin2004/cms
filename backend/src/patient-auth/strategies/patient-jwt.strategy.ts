import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { PatientAccount } from '../entities/patient-account.entity';
import { PATIENT_ACCESS_SECRET, PATIENT_AUDIENCE } from '../patient-config';
import { PatientSessionService } from '../patient-session.service';

/** What `PatientJwtGuard` attaches to `request.patientAuth` (never `request.user`). */
export interface PatientAuth {
  accountId: string;
  sessionId: string;
}

/**
 * Passport strategy `patient-jwt`: patient secret + `aud: 'patient'`. A staff
 * token (other secret, `aud: 'staff'`) never gets past signature verification.
 */
@Injectable()
export class PatientJwtStrategy extends PassportStrategy(
  Strategy,
  'patient-jwt',
) {
  constructor(
    @Inject(PATIENT_ACCESS_SECRET) secret: string,
    private readonly sessions: PatientSessionService,
    @InjectRepository(PatientAccount)
    private readonly accounts: Repository<PatientAccount>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      audience: PATIENT_AUDIENCE,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: {
    sub?: string;
    sid?: string;
    aud?: unknown;
  }): Promise<PatientAuth> {
    if (!payload?.sub || !payload.sid || payload.aud !== PATIENT_AUDIENCE)
      throw new UnauthorizedException();

    if (!(await this.sessions.isAlive(payload.sid, payload.sub)))
      throw new UnauthorizedException();

    const account = await this.accounts.findOne({
      where: { id: payload.sub },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!account || account.status !== 'active' || account.deletedAt)
      throw new UnauthorizedException();

    return { accountId: payload.sub, sessionId: payload.sid };
  }
}
