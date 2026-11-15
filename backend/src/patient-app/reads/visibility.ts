/**
 * What a patient may see (07 §3), as pure functions so the rules are one
 * table-tested place. Fixed rules have no setting; the two settings are
 * resolved per clinic by `PatientClinicsService`.
 */
import type { ClinicStatus } from './patient-reads.types';

export const PRESCRIPTION_VISIBLE_STATUSES = ['FINALIZED', 'AMENDED'] as const;

/** Only a finalized (or amended) prescription that was signed. */
export function isPrescriptionVisible(p: {
  status: string;
  signedAt: Date | string | null | undefined;
}): boolean {
  return (
    (PRESCRIPTION_VISIBLE_STATUSES as readonly string[]).includes(p.status) &&
    p.signedAt !== null &&
    p.signedAt !== undefined
  );
}

/**
 * A-19: a clinic that was never approved shows nothing; a suspended
 * (`is_active = false`) clinic stays readable and is flagged.
 * Returns null = hide every record of this clinic.
 */
export function clinicStatusFor(org: {
  approvalStatus: string;
  isActive: boolean;
}): ClinicStatus | null {
  if (org.approvalStatus !== 'approved') return null;
  return org.isActive ? 'active' : 'suspended';
}

export interface ClinicVisibility {
  showBilling: boolean;
  showDiagnosis: boolean;
}

export const canSeeBilling = (c: ClinicVisibility): boolean => c.showBilling;
export const canSeeDiagnosis = (c: ClinicVisibility): boolean =>
  c.showDiagnosis;
