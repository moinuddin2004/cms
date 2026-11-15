import { createHash, randomBytes } from 'crypto';

/** How long a QR claim token stays valid (staff hand the phone over at the desk). */
export const CLAIM_TOKEN_TTL_MINUTES = 30;

/** Version of the "link this record" consent text stored with each link. */
export const LINK_CONSENT_VERSION = '1.0';

export const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** 256 random bits, URL-safe. Only its hash is ever stored. */
export function generateClaimToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** `ali@example.com` → `a***@example.com`. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** `Ali Raza Khan` → `Ali R. K.`; a single word → `A***`. */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '***';
  if (parts.length === 1) return `${Array.from(parts[0])[0]}***`;
  const [first, ...rest] = parts;
  return [first, ...rest.map((p) => `${Array.from(p)[0]}.`)].join(' ');
}

export type AgeBand = '0-12' | '13-17' | '18-39' | '40-59' | '60+';

/** Coarse age band from a `YYYY-MM-DD` birth date (never the exact age). */
export function ageBand(dob: string | null, now: Date): AgeBand | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  let age = now.getUTCFullYear() - Number(m[1]);
  const beforeBirthday =
    now.getUTCMonth() + 1 < Number(m[2]) ||
    (now.getUTCMonth() + 1 === Number(m[2]) && now.getUTCDate() < Number(m[3]));
  if (beforeBirthday) age -= 1;
  if (age < 0) return null;
  if (age <= 12) return '0-12';
  if (age <= 17) return '13-17';
  if (age <= 39) return '18-39';
  if (age <= 59) return '40-59';
  return '60+';
}
