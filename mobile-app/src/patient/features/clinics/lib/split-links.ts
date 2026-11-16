import type { PatientLink } from '../types/clinics.types';

export interface SplitLinks {
  /** Active and read-only (frozen) links, newest first. */
  current: PatientLink[];
  /** Revoked links, most recently revoked first. */
  past: PatientLink[];
}

const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

/** Separate live links from revoked ones (P-08 shows the second group as history). */
export function splitLinks(links: PatientLink[]): SplitLinks {
  const current = links
    .filter((l) => l.status !== 'revoked')
    .sort((a, b) => time(b.linkedAt) - time(a.linkedAt));
  const past = links
    .filter((l) => l.status === 'revoked')
    .sort((a, b) => time(b.revokedAt ?? b.linkedAt) - time(a.revokedAt ?? a.linkedAt));
  return { current, past };
}
