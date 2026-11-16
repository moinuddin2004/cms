/**
 * PHI scrubber for error reports (docs/03 §2.7, DECISIONS A-24).
 *
 * Nothing leaves the app except what passes through here: an error's name, a
 * scrubbed message, an optional API code / HTTP status, and a small allow-list
 * of context keys. Request/response bodies, headers, URLs with ids, names,
 * emails, phones and tokens are never forwarded.
 */

const MAX_MESSAGE = 200;

/** Context keys a caller may pass; anything else is dropped. */
export const CONTEXT_ALLOW_LIST = ['route', 'code', 'status', 'source', 'screen', 'space'] as const;

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
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
    .replace(BEARER, '[token]')
    .replace(EMAIL, '[email]')
    .replace(UUID, '[id]')
    .replace(TOKENISH, '[token]')
    .replace(DIGITS, '[number]');
  return out.length > MAX_MESSAGE ? `${out.slice(0, MAX_MESSAGE)}…` : out;
}

/** `/patient-api/records/1f2e…/prescriptions?x=1` → `/patient-api/records/:id/prescriptions`. */
export function scrubRoute(route: string): string {
  const path = route.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').split(/[?#]/)[0] ?? '';
  return path
    .split('/')
    .map((seg) => (/^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg) || seg.length >= 24 ? ':id' : seg))
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
  message: string;
  code?: string;
  status?: number;
}

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
    const name = typeof e.name === 'string' ? scrubString(e.name) : 'Error';
    const out: ScrubbedError = {
      name,
      // Axios messages are generic ("Request failed with status code 500") but
      // other errors may embed values, so always scrub.
      message: typeof e.message === 'string' ? scrubString(e.message) : '',
    };
    if (typeof e.code === 'string') out.code = scrubString(e.code);
    if (typeof e.response?.status === 'number') out.status = e.response.status;
    return out;
  }
  return { name: 'NonError', message: typeof err === 'string' ? scrubString(err) : '' };
}
