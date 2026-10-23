import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ActivityTimeline } from '@/components/shared/ActivityTimeline'
import { usePatientAuditTrail } from '../hooks/usePatientSubEntities'

const ENTITY_LABEL: Record<string, string> = {
  patient: 'Patient',
  patient_dental_info: 'Dental info',
  patient_teeth_chart: 'Dental chart',
  patient_vitals: 'Vitals',
  patient_treatment_plan: 'Treatment plan',
  treatment_plan_item: 'Plan item',
  patient_prescription: 'Prescription',
  patient_document: 'Document',
  patient_consent: 'Consent',
  patient_communication: 'Communication',
  patient_recall: 'Recall',
  patient_referral: 'Referral',
  patient_feedback: 'Feedback',
  patient_insurance: 'Insurance',
}

const FIELD_LABEL: Record<string, string> = {
  fullName: 'Name',
  dob: 'Date of birth',
  cnic: 'CNIC',
  whatsappNumber: 'WhatsApp',
  isActive: 'Active',
  bpSystolic: 'BP systolic',
  bpDiastolic: 'BP diastolic',
  oxygenSaturation: 'SpO₂ (%)',
  weightKg: 'Weight (kg)',
  heightCm: 'Height (cm)',
  bmi: 'BMI',
}

/** Staff ids — the audit row already names who acted. */
const HIDDEN = new Set([
  'recordedBy',
  'sentBy',
  'uploadedBy',
  'prescribedBy',
  'assignedTo',
  'respondedBy',
  'anesthesiaAdministeredBy',
])

/** Every change to this patient and their records, with who made it. */
export function PatientAuditSheet({
  patientId,
  patientName,
  open,
  onOpenChange,
}: {
  patientId: string
  patientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const trail = usePatientAuditTrail(patientId, open)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border-soft px-6 py-5">
          <SheetTitle className="text-[17px] font-bold">
            {patientName} — change history
          </SheetTitle>
          <SheetDescription className="text-[13px] text-text-3">
            Every edit to the patient and their records, with who made it.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ActivityTimeline
            entries={trail.data}
            isLoading={trail.isLoading}
            isError={trail.isError}
            onRetry={() => void trail.refetch()}
            fieldLabels={FIELD_LABEL}
            entityLabels={ENTITY_LABEL}
            hiddenFields={HIDDEN}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
