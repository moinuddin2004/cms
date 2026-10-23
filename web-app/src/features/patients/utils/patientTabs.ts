import type { AccessChecks } from '@/features/access'

export type PatientTab =
  | 'overview'
  | 'appointments'
  | 'visits'
  | 'treatments'
  | 'vitals-dental'
  | 'teeth-chart'
  | 'clinical'
  | 'consents'
  | 'billing'
  | 'files'

/**
 * Patient detail tabs the viewer may open, in display order. Each tab
 * mirrors the permission its API needs (a permission implies its feature);
 * reads guarded only by `patients.clinical.view` also need their feature.
 */
export function visiblePatientTabs(
  access: Pick<AccessChecks, 'can' | 'hasFeature'>,
): PatientTab[] {
  const { can, hasFeature } = access
  const clinical = can('patients.clinical.view')
  const rules: Record<PatientTab, boolean> = {
    overview: true,
    appointments: can('appointments.view'),
    visits: clinical,
    treatments: clinical,
    'vitals-dental': clinical,
    'teeth-chart': clinical && hasFeature('patients.teeth_chart'),
    clinical: clinical && hasFeature('patients.prescriptions'),
    consents: clinical,
    billing: can('billing.invoice.view'),
    files: can('patients.documents.manage'),
  }
  return (Object.keys(rules) as PatientTab[]).filter((t) => rules[t])
}
