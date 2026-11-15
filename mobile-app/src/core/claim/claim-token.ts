import { createURL } from 'expo-linking';

/**
 * A claim token is 32 random bytes as base64url (43 chars, docs/07 §4.1). The
 * format check only rejects obvious junk before any request; the server is the
 * judge of validity. The token is a bearer secret: never log it, never put it
 * in prefs, analytics or error text (docs/03).
 */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{32,128}$/;

export function isClaimToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_FORMAT.test(value);
}

/** Normalise a route param (string | string[] | undefined) to a token or `null`. */
export function parseClaimParam(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  return isClaimToken(value) ? value : null;
}

/** The link a QR code carries: opens this app's `claim/[token]` route (works for every build variant's scheme). */
export function buildClaimLink(token: string): string {
  return createURL(`claim/${token}`);
}
