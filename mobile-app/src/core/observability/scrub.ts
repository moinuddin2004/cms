/**
 * PHI scrubber for error reports (docs/03 §2.7, DECISIONS A-24).
 *
 * Nothing leaves the app except what passes through here: an error's name, an
 * optional API code / HTTP status, a message ONLY when it is one of the known
 * generic transport messages, and a small allow-list of context keys.
 * Request/response bodies, headers, URLs with ids, names, emails, phones and
 * tokens are never forwarded. A free-text message can contain a patient name
 * (regexes cannot find names), so unknown messages are dropped, not scrubbed.
 */

const MAX_MESSAGE = 200;

/** Context keys a caller may pass; anything else is dropped. */
export const CONTEXT_ALLOW_LIST = ['route', 'code', 'status', 'source', 'screen', 'space'] as const;

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
// key=value / key: value pairs that carry a secret, whatever the value's length.
const SECRET_PAIR = /\b(refresh[_-]?token|access[_-]?token|token|password|passcode|secret|otp|code)\b("?\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi;
const URL_RE = /\b[a-z][a-z0-9+.-]*:\/\/[^\s'")]+/gi;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const BEARER = /\b(bearer|basic)\s+[a-z0-9._~+/=-]+/gi;
// base64url / hex runs that look like tokens (claim tokens are 43 chars).
const TOKENISH = /\b[A-Za-z0-9_-]{24,}\b/g;
// Phone numbers and other long digit runs (optionally with + - space separators).
const DIGITS = /\+?\d[\d\s-]{5,}\d/g;

/** Replaces everything that could identify a person or a session. */
export function scrubString(input: string): string {
  const out = input
    .replace(URL_RE, '[url]')
    .replace(JWT, '[token]')
    .replace(SECRET_PAIR, (_m, key: string, sep: string) => `${key}${sep}[redacted]`)
    .replace(BEARER, '[token]')
    .replace(EMAIL, '[email]')
    .replace(UUID, '[id]')
    .replace(TOKENISH, '[token]')
    .replace(DIGITS, '[number]');
  return out.length > MAX_MESSAGE ? `${out.slice(0, MAX_MESSAGE)}…` : out;
}

/** Path nouns whose next segment is an identifier, whatever its shape or length. */
const ID_AFTER = new Set([
  'patients', 'patient', 'profiles', 'profile', 'claim', 'claims', 'visit', 'visits', 'appointments',
  'appointment', 'prescriptions', 'prescription', 'records', 'links', 'clinics', 'medications',
  'schedules', 'dose-events', 'invites', 'join', 'c', 'v', 'entries', 'encounters',
]);

/** `/patient-api/records/1f2e…/prescriptions?x=1` → `/patient-api/records/:id/prescriptions`. */
export function scrubRoute(route: string): string {
  const path = route.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').split(/[?#]/)[0] ?? '';
  let afterNoun = false;
  return path
    .split('/')
    .map((seg) => {
      if (!seg) return seg;
      const isId =
        afterNoun || /^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg) || seg.length >= 24;
      afterNoun = ID_AFTER.has(seg.toLowerCase());
      return isId ? ':id' : scrubString(seg);
    })
    .join('/');
}

export type ScrubbedContext = Partial<Record<(typeof CONTEXT_ALLOW_LIST)[number], string | number>>;

/** Keeps only allow-listed keys with primitive values; strings are scrubbed. */
export function scrubContext(context: Record<string, unknown> | undefined): ScrubbedContext {
  const out: ScrubbedContext = {};
  if (!context) return out;
  for (const key of CONTEXT_ALLOW_LIST) {
    const value = context[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string') out[key] = key === 'route' ? scrubRoute(value) : scrubString(value);
  }
  return out;
}

export interface ScrubbedError {
  name: string;
  /** Empty unless the original was a known generic transport message. */
  message: string;
  code?: string;
  status?: number;
}

const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,39}$/;
/** The only free-text messages forwarded: axios / fetch transport wording, no user data. */
const GENERIC_MESSAGES = [
  /^Network Error$/,
  /^Request aborted$/,
  /^timeout of \d+ms exceeded$/,
  /^Request failed with status code \d{3}$/,
  /^canceled$/,
];

/**
 * Error → the safe fields only. Axios errors carry the request config (headers,
 * body) and the response — those are never read, only `code` and `status`.
 */
export function scrubError(err: unknown): ScrubbedError {
  if (err && typeof err === 'object') {
    const e = err as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      response?: { status?: unknown };
    };
    const out: ScrubbedError = {
      name: typeof e.name === 'string' && SAFE_NAME.test(e.name) ? e.name : 'Error',
      message:
        typeof e.message === 'string' && GENERIC_MESSAGES.some((re) => re.test(e.message as string))
          ? e.message
          : '',
    };
    if (typeof e.code === 'string' && SAFE_CODE.test(e.code)) out.code = e.code;
    if (typeof e.response?.status === 'number') out.status = e.response.status;
    return out;
  }
  return { name: 'NonError', message: '' };
}

/** A failure the app already handles in the UI: an API answer or a dropped connection. */
export function isExpectedError(e: ScrubbedError): boolean {
  return e.status !== undefined || e.code !== undefined || e.message === 'Network Error' || /^timeout/.test(e.message);
}
