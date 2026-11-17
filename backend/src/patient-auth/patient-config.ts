import { createHash } from 'crypto';
import type { ConfigService } from '@nestjs/config';

/** DI token: the patient access-token secret (validated at boot). */
export const PATIENT_ACCESS_SECRET = 'PATIENT_ACCESS_SECRET';
/** DI token: the pepper mixed into stored login-code hashes. */
export const PATIENT_CODE_PEPPER = 'PATIENT_CODE_PEPPER';

/** `aud` of a patient-space access token. */
export const PATIENT_AUDIENCE = 'patient';

/** Shortest accepted patient JWT secret (audit L8). */
export const MIN_PATIENT_SECRET_LENGTH = 32;

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
  if (secret.length < MIN_PATIENT_SECRET_LENGTH) {
    throw new Error(
      `JWT_PATIENT_ACCESS_SECRET must be at least ${MIN_PATIENT_SECRET_LENGTH} characters`,
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

const intFrom = (raw: string | undefined, fallback: number): number => {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Abuse limits and retention for the patient space. Every value is an env var with a safe default
 * (documented in the root CLAUDE.md env table); `0` disables nothing — it means "refuse all" for the
 * caps and "keep forever" for the retention periods.
 */
export interface PatientLimits {
  /** Login-code emails the whole platform may send per hour / per day (audit M8). */
  loginCodesPerHour: number;
  loginCodesPerDay: number;
  /** Login-code emails one IP may trigger per 24 h (in memory, resets on restart). */
  loginCodesPerIpPerDay: number;
  /** Failed code guesses per email in 24 h before sign-in is refused (audit M7). */
  failedVerifyPer24h: number;
  /** Absolute session lifetime from `created_at` (audit L6). */
  sessionMaxDays: number;
  /** Retention (audit M9). */
  sessionRetentionMonths: number;
  productEventRetentionDays: number;
  loginCodeRetentionDays: number;
}

export const PATIENT_LIMITS = 'PATIENT_LIMITS';

export function readPatientLimits(
  env: Record<string, string | undefined> = process.env,
): PatientLimits {
  return {
    loginCodesPerHour: intFrom(env.PATIENT_LOGIN_CODES_PER_HOUR, 100),
    loginCodesPerDay: intFrom(env.PATIENT_LOGIN_CODES_PER_DAY, 400),
    loginCodesPerIpPerDay: intFrom(env.PATIENT_LOGIN_CODES_PER_IP_PER_DAY, 30),
    failedVerifyPer24h: intFrom(env.PATIENT_FAILED_VERIFY_PER_24H, 20),
    sessionMaxDays: intFrom(env.PATIENT_SESSION_MAX_DAYS, 180),
    sessionRetentionMonths: intFrom(env.PATIENT_SESSION_RETENTION_MONTHS, 6),
    productEventRetentionDays: intFrom(env.PRODUCT_EVENT_RETENTION_DAYS, 400),
    loginCodeRetentionDays: intFrom(env.PATIENT_LOGIN_CODE_RETENTION_DAYS, 2),
  };
}
