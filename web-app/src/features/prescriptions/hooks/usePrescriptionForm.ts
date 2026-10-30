import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { prescriptionSchema } from '../schemas/prescription.schema'
import type {
  PrescriptionFormValues,
  PrescriptionMedicineValues,
  PrescriptionVitalsValues,
} from '../schemas/prescription.schema'
import { MealRelation } from '../types'
import type {
  CreatePrescriptionInput,
  Prescription,
  PrescriptionMedicine,
  UpdatePrescriptionInput,
} from '../types'
import {
  useCreatePrescription,
  useUpdatePrescription,
} from './usePrescriptions'

export const emptyMedicineLine = (): PrescriptionMedicineValues => ({
  medicineName: '',
  dosage: '1',
  frequency: '',
  frequencyTiming: [],
  mealRelation: MealRelation.NONE,
  duration: '',
})

/** Only the fields the medicine DTO accepts (server rows also carry id etc.). */
export const toMedicineLine = (
  m: PrescriptionMedicine,
): PrescriptionMedicineValues => ({
  medicineDirectoryId: m.medicineDirectoryId ?? undefined,
  medicineName: m.medicineName,
  medicineNameUrdu: m.medicineNameUrdu,
  type: m.type,
  dosage: m.dosage,
  frequency: m.frequency,
  frequencyTiming: m.frequencyTiming ?? [],
  mealRelation: m.mealRelation ?? MealRelation.NONE,
  duration: m.duration,
  specialInstructions: m.specialInstructions,
  specialInstructionsUrdu: m.specialInstructionsUrdu,
})

const emptyVitals = (): PrescriptionVitalsValues => ({
  bp: '',
  pulse: '',
  temperature: '',
  spo2: '',
  weight: '',
  height: '',
})

function defaultsFor(
  existing: Prescription | undefined,
): PrescriptionFormValues {
  if (!existing) {
    return {
      patient: null,
      doctorId: '',
      templateId: '',
      treatmentPlanTemplateId: '',
      chiefComplaint: '',
      diagnosis: '',
      furtherPlan: '',
      instructionsEnglish: '',
      instructionsUrdu: '',
      vitals: emptyVitals(),
      medicines: [emptyMedicineLine()],
    }
  }
  const v = existing.vitals ?? {}
  return {
    patient: {
      id: existing.patient?.id ?? existing.patientId,
      fullName: existing.patient?.fullName ?? '',
      phone: existing.patient?.phone ?? '',
      patientNumber: existing.patient?.patientNumber,
      dob: existing.patient?.dob ?? null,
      gender: existing.patient?.gender ?? null,
    },
    doctorId: existing.doctorId ?? existing.doctor?.id ?? '',
    templateId: existing.prescriptionTemplateId ?? '',
    treatmentPlanTemplateId: existing.treatmentPlanTemplateId ?? '',
    chiefComplaint: existing.chiefComplaint ?? '',
    diagnosis: existing.diagnosis ?? '',
    furtherPlan: existing.furtherPlan ?? '',
    instructionsEnglish: existing.instructionsEnglish ?? '',
    instructionsUrdu: existing.instructionsUrdu ?? '',
    vitals: {
      bp: String(v.bp ?? ''),
      pulse: String(v.pulse ?? ''),
      temperature: String(v.temperature ?? ''),
      spo2: String(v.spo2 ?? ''),
      weight: String(v.weight ?? ''),
      height: String(v.height ?? ''),
    },
    medicines: existing.medicines.length
      ? existing.medicines.map(toMedicineLine)
      : [emptyMedicineLine()],
  }
}

const anyVitals = (v: PrescriptionVitalsValues) =>
  Object.values(v).some((x) => x.trim() !== '')

/** What the Save Draft / Finalize button asked for. */
export type PrescriptionIntent = 'draft' | 'finalize'

/**
 * The prescription builder's form: create or edit, saved as a draft or saved
 * and then signed (`onReadyToSign`). Re-seeds when the loaded prescription
 * changes.
 */
export function usePrescriptionForm({
  existing,
  initialAppointmentId,
  onReadyToSign,
}: {
  existing: Prescription | undefined
  initialAppointmentId?: string
  onReadyToSign: () => void
}) {
  const navigate = useNavigate()
  const createMutation = useCreatePrescription()
  const updateMutation = useUpdatePrescription()

  const form = useForm({
    defaultValues: defaultsFor(existing),
    validators: { onChange: prescriptionSchema, onSubmit: prescriptionSchema },
    onSubmitMeta: { intent: 'draft' as PrescriptionIntent },
    onSubmit: async ({ value, meta }) => {
      const common = {
        prescriptionTemplateId: value.templateId || undefined,
        diagnosis: value.diagnosis || undefined,
        chiefComplaint: value.chiefComplaint || undefined,
        furtherPlan: value.furtherPlan || undefined,
        instructionsEnglish: value.instructionsEnglish || undefined,
        instructionsUrdu: value.instructionsUrdu || undefined,
        vitals: anyVitals(value.vitals) ? value.vitals : undefined,
        medicines: value.medicines
          .filter((m) => m.medicineName.trim())
          .map((m, idx) => ({
            ...m,
            sortOrder: idx,
          })) as PrescriptionMedicine[],
      }

      if (existing) {
        // UpdatePrescriptionDto rejects patient / doctor / appointment /
        // preset ids (forbidNonWhitelisted), so only the editable fields go.
        const data: UpdatePrescriptionInput = common
        try {
          await updateMutation.mutateAsync({ id: existing.id, data })
        } catch {
          return // the mutation already showed the error
        }
        if (meta.intent === 'finalize') onReadyToSign()
        else toast.success('Draft saved')
        return
      }

      const payload: CreatePrescriptionInput = {
        patientId: value.patient!.id,
        appointmentId: initialAppointmentId,
        doctorId: value.doctorId || undefined,
        treatmentPlanTemplateId: value.treatmentPlanTemplateId || undefined,
        ...common,
      }
      let created: Prescription
      try {
        created = await createMutation.mutateAsync(payload)
      } catch {
        return // the mutation already showed the error
      }
      if (meta.intent === 'finalize') {
        onReadyToSign()
        return
      }
      toast.success('Draft created')
      navigate({
        to: '/prescriptions/$prescriptionId',
        params: { prescriptionId: created.id },
      })
    },
  })

  useEffect(() => {
    if (existing) form.reset(defaultsFor(existing))
  }, [existing, form])

  return {
    form,
    createMutation,
    pending: createMutation.isPending || updateMutation.isPending,
  }
}
