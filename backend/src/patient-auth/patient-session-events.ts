import { Injectable } from '@nestjs/common';

export interface PatientSessionRevoked {
  accountId: string;
  /** One session (logout, reuse detection); absent = every session of the account (deletion). */
  sessionId?: string;
}

/**
 * In-process signal that a patient session ended, so the realtime gateway can
 * drop that account's sockets at once instead of waiting for the token to
 * expire. Per instance: other API instances rely on the token-expiry timer
 * and the per-subscribe session check.
 */
@Injectable()
export class PatientSessionEvents {
  private readonly listeners = new Set<(e: PatientSessionRevoked) => void>();

  onRevoked(fn: (e: PatientSessionRevoked) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  revoked(e: PatientSessionRevoked): void {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        /* a listener must never break a logout */
      }
    }
  }
}
