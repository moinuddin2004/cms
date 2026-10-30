import { useForm } from '@tanstack/react-form'
import { useAuthStore } from '@/store/useAuthStore'
import { prescriptionSchema } from '../schemas/patient-records.schema'
import type {
  MedicationFormValues,
  PrescriptionFormValues,
} from '../schemas/patient-records.schema'
import { useCreatePrescription } from './usePatientSubEntities'

export const emptyMedication: MedicationFormValues = {
  name: '',
  dosage: '',
  frequency: '',
  instructions: '',
}

const defaultValues: PrescriptionFormValues = {
  chiefComplaint: '',
  diagnosis: '',
  specialInstructions: '',
  medications: [emptyMedication],
}

/** New prescription with one or more medicines (each needs a name). */
export function usePrescriptionForm({
  patientId,
  onSaved,
}: {
  patientId: string
  onSaved: () => void
}) {
  const { mutate, isPending } = useCreatePrescription()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues,
    validators: { onChange: prescriptionSchema, onSubmit: prescriptionSchema },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) return
      mutate(
        {
          patientId,
          ...value,
          prescribedBy: user.uuid,
        },
        { onSuccess: onSaved },
      )
    },
  })

  return { form, isPending }
}
