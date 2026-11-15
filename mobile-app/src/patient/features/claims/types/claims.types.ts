export type ClaimRelation = 'self' | 'child' | 'parent' | 'spouse' | 'other';

export type AgeBand = '0-12' | '13-17' | '18-39' | '40-59' | '60+';

export interface ClinicRef {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
}

/** `GET /patient-api/claims/:token` (docs/07 §6.2). The server never reveals the full name. */
export interface ClaimPreview {
  clinic: ClinicRef;
  location: { name: string };
  maskedName: string;
  ageBand: AgeBand | null;
  isMinor: boolean;
  alreadyLinkedToYou: boolean;
}

export interface AcceptClaimInput {
  relation: ClaimRelation;
  newProfileName?: string;
  confirm: true;
}

export interface AcceptClaimResult {
  link: { id: string; profileId: string; clinic: ClinicRef; status: string };
  profile: { id: string; relation: ClaimRelation; fullName: string; isSelf: boolean };
}
