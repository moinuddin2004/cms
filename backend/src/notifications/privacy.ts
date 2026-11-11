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
