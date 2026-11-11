import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PATIENT_ACCESS_SECRET, PATIENT_AUDIENCE } from './patient-config';

export interface PatientTokenPayload {
  sub: string;
  sid: string;
}

/** Signs and verifies patient access tokens (patient secret, `aud: 'patient'`, 15 min). */
@Injectable()
export class PatientTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(PATIENT_ACCESS_SECRET) private readonly secret: string,
  ) {}

  sign(accountId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: accountId, sid: sessionId },
      {
        secret: this.secret,
        expiresIn: '15m',
        audience: PATIENT_AUDIENCE,
        algorithm: 'HS256',
      },
    );
  }

  /** Throws when the signature, expiry or audience is wrong. */
  verify(token: string): Promise<PatientTokenPayload> {
    return this.jwt.verifyAsync<PatientTokenPayload>(token, {
      secret: this.secret,
      audience: PATIENT_AUDIENCE,
      algorithms: ['HS256'],
    });
  }
}
