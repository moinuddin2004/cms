import { useForm } from '@tanstack/react-form'
import { dentalInfoSchema } from '../schemas/patient-records.schema'
import type { DentalInfoFormValues } from '../schemas/patient-records.schema'
import { BrushingFrequency, FlossingFrequency, GumCondition } from '../types'
import type { PatientDentalInfo } from '../types'
import { useUpsertDentalInfo } from './usePatientSubEntities'

function defaultsFor(existing?: PatientDentalInfo): DentalInfoFormValues {
  return {
    gumCondition: existing?.gumCondition || GumCondition.HEALTHY,
    brushingFrequency: existing?.brushingFrequency || BrushingFrequency.UNKNOWN,
    flossingFrequency: existing?.flossingFrequency || FlossingFrequency.UNKNOWN,
    teethSensitivity: existing?.teethSensitivity ?? false,
    sensitivityNotes: existing?.sensitivityNotes || '',
    smokingStatus: existing?.smokingStatus ?? false,
    tobaccoChewing: existing?.tobaccoChewing ?? false,
    orthodonticHistory: existing?.orthodonticHistory ?? false,
    orthodonticNotes: existing?.orthodonticNotes || '',
    teethConditionNotes: existing?.teethConditionNotes || '',
    previousExtractions: existing?.previousExtractions || '',
    previousSurgeries: existing?.previousSurgeries || '',
    dentistNotes: existing?.dentistNotes || '',
  }
}

/** Create or update a patient's dental info (one record per patient). */
export function useDentalInfoForm({
  patientId,
  existing,
  onSaved,
}: {
  patientId: string
  existing?: PatientDentalInfo
  onSaved?: () => void
}) {
  const { mutate, isPending } = useUpsertDentalInfo()

  const form = useForm({
    defaultValues: defaultsFor(existing),
    validators: { onChange: dentalInfoSchema, onSubmit: dentalInfoSchema },
    onSubmit: async ({ value }) => {
      mutate({ patientId, ...value }, { onSuccess: () => onSaved?.() })
    },
  })

  return { form, isPending }
}
