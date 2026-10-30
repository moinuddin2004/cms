import { useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { makeTreatmentSchema } from '../schemas/treatment.schema'
import type { TreatmentFormValues } from '../schemas/treatment.schema'
import type { ProcedureOption } from '../types'
import { buildTreatmentInput } from '../utils/treatmentInput'
import { useAddTreatment } from './useConsultation'

const blankTreatment: TreatmentFormValues = {
  selected: null,
  name: '',
  tooth: '',
}

/** Add one treatment to this visit; the row clears after it is saved. */
export function useTreatmentForm({
  encounterId,
  patientId,
  catalog,
  onAdded,
}: {
  encounterId: string
  patientId: string
  catalog: ProcedureOption[]
  onAdded: () => void
}) {
  const add = useAddTreatment(encounterId, patientId)
  const hasCatalog = catalog.length > 0
  const schema = useMemo(() => makeTreatmentSchema(hasCatalog), [hasCatalog])

  const form = useForm({
    defaultValues: blankTreatment,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value, formApi }) => {
      const input = buildTreatmentInput(value, catalog)
      if (!input || add.isPending) return
      add.mutate(input, {
        onSuccess: () => {
          formApi.reset()
          onAdded()
        },
      })
    },
  })

  return { form, add }
}
