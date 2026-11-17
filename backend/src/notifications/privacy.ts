/**
 * Privacy helpers for outbound messages (docs/03 §5, A-14).
 *
 * A remote push lands on a lock screen, so it may carry the patient's
 * **first name only** — never the full name, phone, diagnosis or amounts.
 * The bell (in-app) is behind the phone's lock and keeps the full name.
 */

/**
 * First whitespace-separated token of a full name: `"Ali Khan"` → `"Ali"`,
 * `"  Ali   Khan "` → `"Ali"`, `"Ali"` → `"Ali"`, empty/null → `""`.
 */
export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * The only placeholders a PUSH template may use (docs/03 §5, audit M2): a lock
 * screen may show the patient's first name, a token, the clinic and doctor
 * names, a time and the queue position — never `{patient_name}`,
 * `{recipient_name}`, amounts, reasons or anything else an event offers.
 */
export const PUSH_SAFE_VARIABLES: readonly string[] = [
  'patient_first_name',
  'token',
  'clinic_name',
  'doctor_name',
  'appointment_time',
  'ahead_text',
];
