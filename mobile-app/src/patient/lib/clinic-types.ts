/** Clinic / location shapes shared by the patient API responses (07 §6.1, A-19). */
export type ClinicStatus = 'active' | 'suspended';

export interface ClinicRef {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  clinicStatus: ClinicStatus;
}

export interface LocationRef {
  id: string;
  name: string;
  /** IANA zone: instants of this clinic are shown on this clock (A-10). */
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}
