import { createHash } from 'crypto';
import type { ConfigService } from '@nestjs/config';

/** DI token: the patient access-token secret (validated at boot). */
export const PATIENT_ACCESS_SECRET = 'PATIENT_ACCESS_SECRET';
/** DI token: the pepper mixed into stored login-code hashes. */
export const PATIENT_CODE_PEPPER = 'PATIENT_CODE_PEPPER';

/** `aud` of a patient-space access token. */
export const PATIENT_AUDIENCE = 'patient';

/**
 * The patient secret must exist and differ from the staff secret — otherwise a
 * token of one space could verify in the other (03 §3 rule 5). Throws at boot.
 */
export function assertPatientSecret(
  config: Pick<ConfigService, 'get'>,
): string {
  const secret = config.get<string>('JWT_PATIENT_ACCESS_SECRET');
  if (!secret || !secret.trim()) {
    throw new Error(
      'JWT_PATIENT_ACCESS_SECRET is required for the patient space',
    );
  }
  if (secret === config.get<string>('JWT_ACCESS_SECRET')) {
    throw new Error(
      'JWT_PATIENT_ACCESS_SECRET must differ from JWT_ACCESS_SECRET',
    );
  }
  return secret;
}

/** `PATIENT_CODE_PEPPER`, else derived from the patient secret. */
export function resolveCodePepper(
  config: Pick<ConfigService, 'get'>,
  patientSecret: string,
): string {
  const explicit = config.get<string>('PATIENT_CODE_PEPPER');
  if (explicit && explicit.trim()) return explicit;
  return createHash('sha256')
    .update(`patient-code-pepper:${patientSecret}`)
    .digest('hex');
}
