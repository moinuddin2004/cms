import { differenceInYears } from 'date-fns'
import { todayYmd, ymdToDate } from '@/lib/datetime'
import type { Patient, PatientVitals } from '@/features/patients'

export function ageLabel(dob: string | null | undefined): string | null {
  if (!dob) return null
  // DOB is a calendar date: compare calendar days, never shift it by a timezone.
  const years = differenceInYears(
    ymdToDate(todayYmd()),
    ymdToDate(dob.slice(0, 10)),
  )
  return Number.isNaN(years) ? null : `${years} y`
}

export interface PatientAlert {
  key: string
  label: string
  detail?: string
  /** `danger` for things that can hurt the patient today; `warn` for context. */
  tone: 'danger' | 'warn'
}

/** The latest vitals record, whatever order the API returned them in. */
export function latestVitals(
  list: PatientVitals[] | undefined,
): PatientVitals | null {
  if (!list || list.length === 0) return null
  return [...list].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )[0]
}

/**
 * What the doctor must not miss before treating: allergies, conditions and
 * medicines that change what is safe to prescribe.
 */
export function patientAlerts(
  patient: Patient,
  vitals: PatientVitals | null,
): PatientAlert[] {
  const alerts: PatientAlert[] = []
  if (patient.allergies?.trim()) {
    alerts.push({
      key: 'allergies',
      label: 'Allergy',
      detail: patient.allergies.trim(),
      tone: 'danger',
    })
  }
  if (vitals?.isOnBloodThinners) {
    alerts.push({ key: 'thinners', label: 'Blood thinners', tone: 'danger' })
  }
  if (vitals?.isPregnant) {
    alerts.push({ key: 'pregnant', label: 'Pregnant', tone: 'danger' })
  }
  if (vitals?.isDiabetic) {
    alerts.push({ key: 'diabetic', label: 'Diabetic', tone: 'warn' })
  }
  if (vitals?.isHypertensive) {
    alerts.push({ key: 'bp', label: 'Hypertensive', tone: 'warn' })
  }
  if (vitals?.isOnAntibiotics) {
    alerts.push({ key: 'abx', label: 'On antibiotics', tone: 'warn' })
  }
  if (patient.medicalHistory?.trim()) {
    alerts.push({
      key: 'history',
      label: 'Medical history',
      detail: patient.medicalHistory.trim(),
      tone: 'warn',
    })
  }
  if (patient.isMinor) {
    alerts.push({
      key: 'minor',
      label: 'Minor',
      detail: patient.guardianName
        ? `Guardian: ${patient.guardianName}`
        : undefined,
      tone: 'warn',
    })
  }
  return alerts
}
