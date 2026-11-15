import type { PatientDetail, Vitals } from '../types/patients.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params are user-controlled (deep links): only a UUID is ever sent to the API. */
export const isPatientId = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);

/**
 * Age text from a plain `YYYY-MM-DD` date of birth and the clinic's `today`
 * (both calendar dates, no timezone maths). `null` for a missing, malformed or
 * future dob. Under one year → months ("8m").
 */
export function ageLabel(dob: string | null | undefined, today: string): string | null {
  const parse = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').map(Number) : null;
  const b = dob ? parse(dob) : null;
  const t = parse(today);
  if (!b || !t) return null;
  const months = (t[0] - b[0]) * 12 + (t[1] - b[1]) - (t[2] < b[2] ? 1 : 0);
  if (months < 0) return null;
  return months < 12 ? `${months}m` : `${Math.floor(months / 12)}y`;
}

const GENDER_LABEL = { male: 'Male', female: 'Female', other: 'Other' } as const;

/** `P-00034 · 34y · Male · O+` — missing parts are left out. */
export function patientSubtitle(
  patient: Pick<PatientDetail, 'patientNumber' | 'dob' | 'gender' | 'bloodGroup'>,
  today: string,
): string {
  return [
    patient.patientNumber,
    ageLabel(patient.dob, today),
    patient.gender ? GENDER_LABEL[patient.gender] : null,
    patient.bloodGroup,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** `tel:` URL, or `null` when there is nothing dialable. Keeps only digits and a leading `+`. */
export function telUrl(phone: string | null | undefined): string | null {
  const raw = (phone ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  return `tel:${raw.startsWith('+') ? '+' : ''}${digits}`;
}

/** Calling code by the clinic's currency (the app has no clinic country field yet). */
const DIAL_CODE_BY_CURRENCY: Record<string, string> = {
  PKR: '92',
  INR: '91',
  BDT: '880',
  AED: '971',
  SAR: '966',
  GBP: '44',
  USD: '1',
};

/** Calling code (digits, no `+`) for a currency code, or `undefined` when unknown. */
export const dialCodeForCurrency = (currency: string | null | undefined): string | undefined =>
  currency ? DIAL_CODE_BY_CURRENCY[currency.toUpperCase()] : undefined;

/**
 * `https://wa.me/<digits>` (international format, digits only). A leading `+` or `00`
 * marks an international number and is kept as is; a national number with a trunk `0`
 * (`0300…`) gets the clinic's `countryCode` ("92") in place of the `0`. Without a
 * country code a local number is passed through unchanged.
 */
export function whatsappUrl(phone: string | null | undefined, countryCode?: string): string | null {
  const raw = (phone ?? '').trim();
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (!raw.startsWith('+') && countryCode && digits.startsWith('0')) {
    digits = countryCode + digits.slice(1);
  }
  return `https://wa.me/${digits}`;
}

/** A number the user may display: the number to contact on WhatsApp (own WhatsApp number first). */
export const whatsappTarget = (p: Pick<PatientDetail, 'whatsappNumber' | 'phone'>) =>
  p.whatsappNumber?.trim() || p.phone;

/** Decimal columns can arrive as numeric strings — format tolerantly, never assume `number`. */
export function fmtNum(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : null;
}

/** Labelled vitals worth showing, only the recorded ones: `BP 120/80`, `Pulse 72`, … */
export function vitalsParts(v: Vitals): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (v.bpSystolic !== null && v.bpDiastolic !== null) {
    out.push({ label: 'BP', value: `${v.bpSystolic}/${v.bpDiastolic} mmHg` });
  }
  const add = (label: string, raw: number | string | null, unit: string) => {
    const n = fmtNum(raw);
    if (n !== null) out.push({ label, value: `${n} ${unit}` });
  };
  add('Pulse', v.pulseRate, 'bpm');
  add('Temp', v.temperature, '°C');
  add('SpO₂', v.oxygenSaturation, '%');
  add('Weight', v.weightKg, 'kg');
  add('Height', v.heightCm, 'cm');
  add('BMI', v.bmi, '');
  return out.map((p) => ({ ...p, value: p.value.trim() }));
}

export type PatientSegment = 'overview' | 'visits' | 'rx' | 'chart';

/**
 * Segments to offer. Overview and Visits always (their clinical parts hide
 * themselves); Rx and Chart only when their gated hook is `allowed` — never
 * while access is still loading, so a tab never flashes in and out.
 */
export function visibleSegments(access: { rx: string; chart: string }): PatientSegment[] {
  const out: PatientSegment[] = ['overview', 'visits'];
  if (access.rx === 'allowed') out.push('rx');
  if (access.chart === 'allowed') out.push('chart');
  return out;
}

const CONDITION_LABEL: Record<string, string> = {
  CARIES: 'Caries',
  FILLED: 'Filled',
  CROWN: 'Crown',
  IMPLANT: 'Implant',
  EXTRACTION_NEEDED: 'Extraction',
  MISSING: 'Missing',
  ROOT_CANAL: 'Root canal',
};
const label = (c: string) => CONDITION_LABEL[c] ?? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ');

/**
 * One chart finding per tooth, read tolerantly (FDI tooth keys; the jsonb model is
 * `{ condition?, planned?, rootCanal?, surfaces?: { M|O|… : { condition, planned } }, note? }`,
 * older charts stored `"16": "CARIES"`). Teeth without a finding are dropped.
 */
export function chartConditions(
  chartData: Record<string, unknown> | null | undefined,
): { tooth: string; text: string }[] {
  const out: { tooth: string; text: string }[] = [];
  for (const [tooth, raw] of Object.entries(chartData ?? {})) {
    const parts: string[] = [];
    if (typeof raw === 'string') {
      if (raw) parts.push(label(raw));
    } else if (raw && typeof raw === 'object') {
      const e = raw as Record<string, unknown>;
      const planned = (v: unknown) => (v === true ? ' (planned)' : '');
      if (typeof e.condition === 'string') parts.push(label(e.condition) + planned(e.planned));
      const rc = e.rootCanal;
      if (rc && typeof rc === 'object') {
        parts.push('Root canal' + planned((rc as { planned?: unknown }).planned));
      }
      const surfaces = e.surfaces;
      if (surfaces && typeof surfaces === 'object') {
        for (const [surface, mark] of Object.entries(surfaces as Record<string, unknown>)) {
          const m = mark as { condition?: unknown; planned?: unknown } | null;
          if (m && typeof m.condition === 'string') {
            parts.push(`${label(m.condition)} ${surface}${planned(m.planned)}`);
          }
        }
      }
      if (typeof e.note === 'string' && e.note.trim() && parts.length > 0) parts.push(`“${e.note.trim()}”`);
    }
    if (parts.length > 0) out.push({ tooth, text: parts.join(', ') });
  }
  return out.sort((a, b) => a.tooth.localeCompare(b.tooth, undefined, { numeric: true }));
}
