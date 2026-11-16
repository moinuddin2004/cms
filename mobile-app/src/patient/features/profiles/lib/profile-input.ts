import type { ProfileFormValues } from '../schemas/profile.schema';
import type {
  CreateProfileInput,
  FamilyRelation,
  Profile,
  UpdateProfileInput,
} from '../types/profiles.types';

export const FAMILY_RELATIONS: FamilyRelation[] = ['child', 'parent', 'spouse', 'other'];

/** The form's starting values: blank for "add", the profile's own for "edit". */
export function profileDefaults(profile?: Profile): ProfileFormValues {
  return {
    fullName: profile?.fullName ?? '',
    relation: profile?.relation ?? 'child',
    dob: profile?.dob ?? '',
    gender: profile?.gender ?? '',
  };
}

export function toCreateInput(values: ProfileFormValues): CreateProfileInput {
  const dob = values.dob.trim();
  return {
    // The schema allows 'self' for the edit form; a new member can never be it.
    relation: values.relation === 'self' ? 'other' : values.relation,
    fullName: values.fullName.trim(),
    ...(dob ? { dob } : {}),
    ...(values.gender ? { gender: values.gender } : {}),
  };
}

/** Only what changed. Your own profile never sends a relation. An emptied date / gender is cleared with `null`. */
export function toUpdateInput(values: ProfileFormValues, original: Profile): UpdateProfileInput {
  const input: UpdateProfileInput = {};
  const fullName = values.fullName.trim();
  if (fullName !== original.fullName) input.fullName = fullName;
  if (!original.isSelf && values.relation !== 'self' && values.relation !== original.relation) {
    input.relation = values.relation;
  }
  const dob = values.dob.trim() || null;
  if (dob !== original.dob) input.dob = dob;
  const gender = values.gender || null;
  if (gender !== original.gender) input.gender = gender;
  return input;
}
