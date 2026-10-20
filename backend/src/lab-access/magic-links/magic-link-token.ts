import { createHash, createHmac, randomBytes } from 'crypto';

/** Default lifetime (lab ERD §12: 24 hours, configurable). */
export const DEFAULT_TTL_HOURS = 24;
export const MAX_TTL_HOURS = 24 * 7;

/** Base64url of 32 bytes. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const secret = (): string => {
  const s =
    process.env.MAGIC_LINK_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET;
  if (!s) throw new Error('MAGIC_LINK_SECRET (or JWT_ACCESS_SECRET) not set');
  return s;
};

export const ttlHours = (): number => {
  const n = Number(process.env.LAB_MAGIC_LINK_TTL_HOURS);
  return Number.isInteger(n) && n > 0 && n <= MAX_TTL_HOURS
    ? n
    : DEFAULT_TTL_HOURS;
};

/** 32 random bytes, hex — stored; useless without the server secret. */
export const newNonce = (): string => randomBytes(32).toString('hex');

/** The token: HMAC-SHA256(secret, nonce), 32 bytes, base64url. */
export const tokenFor = (nonce: string): string =>
  createHmac('sha256', secret()).update(nonce).digest('base64url');

/** What the database keeps (and looks tokens up by). */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const isTokenShaped = (token: string): boolean =>
  TOKEN_SHAPE.test(token);

export const magicLinkUrl = (token: string): string => {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
  return `${base}/lab-link/${token}`;
};

/**
 * Stand-in for the URL in a stored outbox payload; the worker swaps it for
 * the real link when sending (`PayloadFinalizers`).
 */
export const urlPlaceholder = (linkId: string): string =>
  `[magic-link:${linkId}]`;
export const URL_PLACEHOLDER = /\[magic-link:([0-9a-f-]{36})\]/g;
