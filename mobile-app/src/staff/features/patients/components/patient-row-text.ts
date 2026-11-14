import type { Gender } from '../types/patients.types';
import { maskPhone } from '../lib/mask-phone';

const GENDER_LABEL: Record<Gender, string> = { male: 'Male', female: 'Female', other: 'Other' };

/**
 * Age at `today` from a plain `YYYY-MM-DD` birth date: "34y", or "8m" under a
 * year. `null` when there is no usable date.
 */
export function ageText(dob: string | null | undefined, today: string): string | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 0) return null;
  return months < 12 ? `${months}m` : `${Math.floor(months / 12)}y`;
}

/** First line under the name: `P-00034 · 0300•••4567` (parts that are empty are left out). */
export function idLine(patientNumber: string, phone: string): string {
  return [patientNumber, maskPhone(phone)].filter(Boolean).join(' · ');
}

/** Second line: `34y · Male`. */
export function demographicsLine(
  dob: string | null | undefined,
  gender: Gender | null | undefined,
  today: string,
): string {
  return [ageText(dob, today), gender ? GENDER_LABEL[gender] : null].filter(Boolean).join(' · ');
}
