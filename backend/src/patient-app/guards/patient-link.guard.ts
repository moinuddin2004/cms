import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PatientAuth } from 'src/patient-auth/strategies/patient-jwt.strategy';

export interface PatientContext {
  accountId: string;
  sessionId: string;
  profiles: { id: string; relation: string; isSelf: boolean }[];
  links: {
    id: string;
    profileId: string;
    organizationId: string;
    patientId: string;
    status: 'active' | 'frozen';
    patientAppEnabled: boolean;
  }[];
}

export type PatientRequest = Request & {
  patientAuth?: PatientAuth;
  patientContext?: PatientContext;
};

/**
 * Patient link guard — interim version (M2-02).
 *
 * Builds `request.patientContext` from the authenticated patient with EMPTY
 * profiles and links, so `/patient-api/me` works. M2-03 loads the real links.
 * Without `request.patientAuth` it fails closed.
 */
@Injectable()
export class PatientLinkGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PatientRequest>();
    const auth = request.patientAuth;
    if (!auth) throw new UnauthorizedException();
    // TODO(M2-03): load the account's profiles and active/frozen links.
    request.patientContext = {
      accountId: auth.accountId,
      sessionId: auth.sessionId,
      profiles: [],
      links: [],
    };
    return true;
  }
}
