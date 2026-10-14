/**
 * One-tap phrases so the doctor taps instead of types. Tapping a chip appends
 * the phrase to the field; the doctor can always still type freely.
 */

export const COMPLAINT_PICKS = [
  'Toothache',
  'Tooth sensitivity',
  'Swelling',
  'Bleeding gums',
  'Broken tooth',
  'Bad breath',
  'Loose tooth',
  'Check-up',
  'Cleaning',
  'Pain on chewing',
]

export const DIAGNOSIS_PICKS = [
  'Dental caries',
  'Reversible pulpitis',
  'Irreversible pulpitis',
  'Periapical abscess',
  'Gingivitis',
  'Periodontitis',
  'Fractured tooth',
  'Impacted wisdom tooth',
  'Dentin hypersensitivity',
]

export const ADVICE_PICKS = [
  'Avoid hot & cold food',
  'Do not eat for 2 hours',
  'Soft diet for 2 days',
  'Warm salt-water rinse',
  'Do not spit or rinse today',
  'Brush twice daily',
  'Return if pain or swelling increases',
]

/** Common chair-side procedures — tap one to start recording it. */
export const PROCEDURE_PICKS = [
  'Consultation',
  'X-ray (IOPA)',
  'Scaling & polishing',
  'Composite filling',
  'Extraction',
  'Surgical extraction',
  'Root canal (RCT)',
  'Crown / bridge',
  'Fluoride application',
  'Temporary filling',
]

export const FOLLOW_UP_PICKS: { label: string; days: number }[] = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
]

/** Appends `phrase` to `text` once ("a, b"). */
export function appendPhrase(text: string, phrase: string): string {
  const trimmed = text.trim()
  if (!trimmed) return phrase
  const parts = trimmed.split(/,\s*/).map((p) => p.toLowerCase())
  if (parts.includes(phrase.toLowerCase())) return text
  return `${trimmed.replace(/[,\s]+$/, '')}, ${phrase}`
}
