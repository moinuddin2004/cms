import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Request property the patient identity lives on — never `request.user`. */
export const PATIENT_AUTH_PROPERTY = 'patientAuth';

/**
 * Patient access-token guard: strategy `patient-jwt` (patient secret,
 * `aud: 'patient'`, live session, active account). On success the identity is
 * attached to `request.patientAuth`, so a patient can never be mistaken for
 * staff by code that reads `request.user`.
 */
@Injectable()
export class PatientJwtGuard extends AuthGuard('patient-jwt') {
  getAuthenticateOptions() {
    return { property: PATIENT_AUTH_PROPERTY, session: false };
  }
}
