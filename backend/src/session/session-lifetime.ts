/**
 * Session lifetimes. These are absolute: set once at sign-in and never
 * extended by a token refresh, so a remembered session stays valid for 30
 * days whether or not it is used.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Unchecked "keep me signed in": one day. */
export const SHORT_SESSION_MS = DAY_MS;

/** Checked "keep me signed in": thirty days. */
export const REMEMBERED_SESSION_MS = 30 * DAY_MS;

export function sessionLifetimeMs(rememberMe: boolean): number {
  return rememberMe ? REMEMBERED_SESSION_MS : SHORT_SESSION_MS;
}

export function sessionExpiryFrom(now: Date, rememberMe: boolean): Date {
  return new Date(now.getTime() + sessionLifetimeMs(rememberMe));
}

/** Time left before `expiresAt`; never negative. Used for cookie Max-Age. */
export function remainingLifetimeMs(
  expiresAt: Date,
  now: Date = new Date(),
): number {
  return Math.max(0, expiresAt.getTime() - now.getTime());
}
