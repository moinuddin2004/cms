import { z } from 'zod';

/** The backend's `@MaxLength(500)` on every queue reason (docs/07 §2.3). */
export const REASON_MAX = 500;

/**
 * The one-field form behind the doctor's ReasonSheet. Required reasons
 * (pause) must have visible text; optional ones may be empty.
 */
export function reasonSchema(required: boolean) {
  const reason = z.string().trim().max(REASON_MAX, `Keep it under ${REASON_MAX} characters`);
  return z.object({
    reason: required ? reason.min(1, 'Enter a reason') : reason,
  });
}

export interface ReasonValues {
  reason: string;
}
