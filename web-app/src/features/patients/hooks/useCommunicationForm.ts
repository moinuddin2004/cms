import { useForm } from '@tanstack/react-form'
import { useAuthStore } from '@/store/useAuthStore'
import { CommDirection, CommPurpose, CommStatus, CommType } from '../types'
import { communicationSchema } from '../schemas/patient-records.schema'
import type { CommunicationFormValues } from '../schemas/patient-records.schema'
import { useCreateCommunication } from './usePatientSubEntities'

const defaultValues: CommunicationFormValues = {
  type: CommType.CALL,
  direction: CommDirection.OUTBOUND,
  purpose: CommPurpose.GENERAL,
  subject: '',
  messageBody: '',
}

/** Log a call / message against a patient. */
export function useCommunicationForm({
  patientId,
  onSaved,
}: {
  patientId: string
  onSaved: () => void
}) {
  const { mutate, isPending } = useCreateCommunication()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues,
    validators: {
      onChange: communicationSchema,
      onSubmit: communicationSchema,
    },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) return
      mutate(
        {
          patientId,
          ...value,
          // A manually logged message has already happened.
          status:
            value.direction === CommDirection.INBOUND
              ? CommStatus.RECEIVED
              : CommStatus.SENT,
          sentBy: user.uuid,
        },
        { onSuccess: onSaved },
      )
    },
  })

  return { form, isPending }
}
