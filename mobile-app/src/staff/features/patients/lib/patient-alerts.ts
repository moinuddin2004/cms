import type { PatientAlert, PatientDetail } from '../types/patients.types';

/** Comma-separated allergies → trimmed, non-empty items. */
export function splitAllergies(allergies: string | null | undefined): string[] {
  return (allergies ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

type AlertSource = Pick<
  PatientDetail,
  | 'allergies'
  | 'isBlacklisted'
  | 'blacklistReason'
  | 'isMinor'
  | 'guardianName'
  | 'guardianRelation'
  | 'guardianPhone'
>;

/**
 * Alert strip content — port of the web `Alerts` block
 * (`web-app/.../patients/components/tabs/OverviewTab.tsx`): allergies,
 * blacklisted + reason, minor + guardian. Fixed order; nothing to show → `[]`.
 */
export function patientAlerts(patient: AlertSource): PatientAlert[] {
  const alerts: PatientAlert[] = [];
  const allergies = splitAllergies(patient.allergies);
  if (allergies.length > 0) {
    alerts.push({ kind: 'allergy', title: 'Allergies', text: allergies.join(', ') });
  }
  if (patient.isBlacklisted) {
    alerts.push({
      kind: 'blacklist',
      title: 'Blacklisted',
      text: patient.blacklistReason || 'No reason given',
    });
  }
  if (patient.isMinor) {
    const guardian = [
      patient.guardianName,
      patient.guardianRelation && `(${patient.guardianRelation})`,
      patient.guardianPhone,
    ]
      .filter(Boolean)
      .join(' ');
    alerts.push({
      kind: 'minor',
      title: 'Minor — guardian consent needed',
      text: guardian || 'Guardian not recorded',
    });
  }
  return alerts;
}
