import { apiErrorMessage } from '@/core/http/api-error';
import { log } from '@/core/log';

/**
 * Maps the queue API's `error.code` values to the copy in docs/07 §2.3
 * ("Queue error codes -> UI copy"). Pure apart from the one `log.error` for
 * developer-bug codes (code only, never a payload).
 */

const GENERIC = 'Something went wrong. Please try again.';
const STATUS_CHANGED = "This patient's status changed. Please check and try again.";

/** Codes that mean the screen is out of date: refetch the session / board. */
const REFETCH_CODES: ReadonlySet<string> = new Set([
  'NOT_FOUND',
  'INVALID_TRANSITION',
  'VERSION_CONFLICT',
  'ALREADY_CHECKED_IN',
]);

/** Codes that point at a bug in the app (missing / reused / racing key). */
const DEVELOPER_BUG_CODES: ReadonlySet<string> = new Set([
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'REQUEST_IN_FLIGHT',
]);

const MESSAGES: Readonly<Record<string, string>> = {
  NOT_FOUND: 'This patient is no longer in the queue.',
  FORBIDDEN: "You can't do this for another doctor's queue.",
  INVALID_TRANSITION: STATUS_CHANGED,
  SESSION_NOT_OPEN: "The session isn't open. Start or resume it first.",
  DOCTOR_BUSY: 'Finish the current patient first.',
  VERSION_CONFLICT: STATUS_CHANGED,
  ALREADY_CHECKED_IN: 'Already checked in.',
  // Both are dialogs in the UI (S-02c / S-03); this is the dialog question.
  ACTIVE_WITH_OTHER_DOCTOR: "Already in another doctor's queue. Add anyway?",
  LATE_LIMIT_EXCEEDED: 'Too late for this appointment. Add as walk-in?',
  NOT_TODAY: "This appointment isn't today.",
  // Shown only after the 3 automatic retries gave up.
  LOCK_TIMEOUT: 'Busy, please try again.',
  REASON_REQUIRED: 'A reason is required.',
};

/** The API's machine code (`error.code`), or undefined when the error has none. */
export function queueErrorCode(err: unknown): string | undefined {
  const code = (err as { response?: { data?: { error?: { code?: unknown } } } } | null)?.response
    ?.data?.error?.code;
  return typeof code === 'string' && code ? code : undefined;
}

export function queueErrorMessage(err: unknown): string {
  const code = queueErrorCode(err);
  if (code && DEVELOPER_BUG_CODES.has(code)) {
    log.error('QueueRequestError', code);
    return GENERIC;
  }
  if (code && Object.hasOwn(MESSAGES, code)) return MESSAGES[code];
  // Unknown code or none (network error, validation array, 5xx).
  return apiErrorMessage(err, GENERIC);
}

/** True when the cached queue is stale and should be refetched after this error. */
export function shouldRefetch(err: unknown): boolean {
  const code = queueErrorCode(err);
  return code !== undefined && REFETCH_CODES.has(code);
}
