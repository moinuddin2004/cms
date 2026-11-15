import type { ClinicRef, LocationRef } from '@/patient/lib/clinic-types';

export type Relation = 'self' | 'child' | 'parent' | 'spouse' | 'other';
/** The relations a family member can have (`self` is created by sign-up / the first claim). */
export type FamilyRelation = Exclude<Relation, 'self'>;
export type Gender = 'male' | 'female' | 'other';

export interface ProfileLink {
  id: string;
  clinic: ClinicRef;
  location: LocationRef | null;
  status: 'active' | 'frozen';
  linkedAt: string;
}

/** `GET /patient-api/profiles` row. */
export interface Profile {
  id: string;
  relation: Relation;
  fullName: string;
  /** YYYY-MM-DD */
  dob: string | null;
  gender: Gender | null;
  isSelf: boolean;
  links: ProfileLink[];
}

export interface CreateProfileInput {
  relation: FamilyRelation;
  fullName: string;
  dob?: string;
  gender?: Gender;
}

/** `null` clears `dob` / `gender`; an omitted key is left alone. */
export interface UpdateProfileInput {
  relation?: FamilyRelation;
  fullName?: string;
  dob?: string | null;
  gender?: Gender | null;
}
