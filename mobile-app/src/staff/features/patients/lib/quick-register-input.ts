import type { QuickRegisterValues } from '../schemas/quick-register.schema';
import type { CreatePatientInput, Gender } from '../types/patients.types';

const GENDERS: readonly string[] = ['male', 'female', 'other'];
const clean = (v: string | undefined): string | undefined => v?.trim() || undefined;

/**
 * Form values to the `POST /patients` body. TanStack Form hands `onSubmit` the raw
 * values (validators do not transform), so this applies the same cleaning as
 * `quickRegisterSchema`: trim, blank is omitted, guardian fields only for minors.
 */
export function toCreatePatientInput(values: QuickRegisterValues): CreatePatientInput {
  const gender =
    typeof values.gender === 'string' && GENDERS.includes(values.gender)
      ? (values.gender as Gender)
      : undefined;
  const input: CreatePatientInput = {
    fullName: values.fullName.trim(),
    phone: values.phone.trim(),
    dob: clean(values.dob),
    gender,
    isMinor: values.isMinor,
  };
  if (values.isMinor) {
    input.guardianName = clean(values.guardianName);
    input.guardianPhone = clean(values.guardianPhone);
    input.guardianRelation = clean(values.guardianRelation);
  }
  return input;
}
