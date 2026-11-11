import { CanActivate, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Patient access-token guard — stub for M0-09.
 *
 * The real guard (M2-02) verifies the patient JWT with
 * `JWT_PATIENT_ACCESS_SECRET` and `aud: 'patient'`, checks that the session is
 * alive and attaches `request.patientContext`. Until it exists every
 * `@PatientApi()` route must fail closed.
 */
@Injectable()
export class PatientJwtGuard implements CanActivate {
  canActivate(): boolean {
    // TODO(M2-02): replace with the real patient access-token guard.
    throw new UnauthorizedException();
  }
}
