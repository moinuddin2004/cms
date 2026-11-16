import type {
  ClinicRefDto,
  LocationRefDto,
} from '../reads/patient-reads.types';

/** One clinic link of the account (07 §6.2). `revoked*` is set once the link is gone. */
export interface PatientLinkDto {
  id: string;
  profileId: string;
  clinic: ClinicRefDto;
  location: LocationRefDto | null;
  status: 'active' | 'frozen' | 'revoked';
  linkedAt: string;
  linkMethod: string;
  linkedByLabel: string;
  revokedAt: string | null;
  revokedBy: 'patient' | 'clinic' | 'system' | null;
}

export interface PatientLinkHistoryDto {
  at: string;
  action:
    | 'linked'
    | 'unlinked_by_you'
    | 'revoked_by_clinic'
    | 'revoked_by_system';
  /** English fallback; the app localises by `action`. */
  label: string;
}
