import { createHash, randomBytes } from 'crypto';

/** A visit link is only useful for the day of the visit. */
export const VISIT_TOKEN_TTL_HOURS = 12;

export const VISIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** 256 random bits, URL-safe. Only its hash is ever stored. */
export function generateVisitToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashVisitToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
