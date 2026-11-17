import { Injectable } from '@nestjs/common';

export interface StaffSessionRevoked {
  /** One session (logout / revoke). */
  sessionId?: string;
  /** Every session of this user (revoke-all, password reset, deactivation) … */
  userId?: string;
  /** … except this one (the caller's own). */
  exceptSessionId?: string;
}

/**
 * In-process signal that staff sessions ended, so the realtime gateway can drop
 * those sockets at once instead of waiting for the access token to expire
 * (audit M6). Per instance: other API instances rely on the token-expiry timer
 * and the per-subscribe session check. Same contract as `PatientSessionEvents`.
 */
@Injectable()
export class StaffSessionEvents {
  private readonly listeners = new Set<(e: StaffSessionRevoked) => void>();

  onRevoked(fn: (e: StaffSessionRevoked) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  revoked(e: StaffSessionRevoked): void {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        /* a listener must never break a logout */
      }
    }
  }
}
