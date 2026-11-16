import type { ClinicRef, LocationRef } from '@/patient/lib/clinic-types';

export type LinkStatus = 'active' | 'frozen' | 'revoked';
export type RevokedBy = 'patient' | 'clinic' | 'system';

/** `GET /patient-api/links` row (07 §6.2). `revoked*` is set once the link is gone. */
export interface PatientLink {
  id: string;
  profileId: string;
  clinic: ClinicRef;
  location: LocationRef | null;
  status: LinkStatus;
  linkedAt: string;
  linkMethod: string;
  linkedByLabel: string;
  revokedAt: string | null;
  revokedBy: RevokedBy | null;
}

export type LinkHistoryAction =
  | 'linked'
  | 'unlinked_by_you'
  | 'revoked_by_clinic'
  | 'revoked_by_system';

/** `GET /patient-api/links/:id/history` row, newest first. */
export interface LinkHistoryEntry {
  at: string;
  action: LinkHistoryAction;
  label: string;
}
