/**
 * A claim token is exactly 32 random bytes as base64url — 43 chars, the backend's
 * `CLAIM_TOKEN_PATTERN` (docs/03, docs/07 §4.1). The check only rejects junk
 * before any request; the server judges validity. The token is a bearer secret:
 * never log it, never put it in prefs, analytics or error text.
 */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export function isClaimToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_FORMAT.test(value);
}

/** Normalise a route param (string | string[] | undefined) to a token or `null`. */
export function parseClaimParam(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  return isClaimToken(value) ? value : null;
}
