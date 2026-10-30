import { useEffect, useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { toast } from 'sonner'
import { AppointmentType } from '@/features/appointments/types'
import type {
  AppointmentFormData,
  ValidationResult,
} from '@/features/appointments/types'
import { useCreateAppointment } from '@/features/appointments/hooks/useCreateAppointment'
import { useValidateAppointment } from '@/features/appointments/hooks/useValidateAppointment'
import { toDateTimeLocalValue } from '@/features/appointments/utils/datetime'
import { firstAppointmentSchema } from '../schemas/firstAppointment.schema'
import type { FirstAppointmentFormValues } from '../schemas/firstAppointment.schema'

const DEFAULT_VALUES: FirstAppointmentFormValues = {
  doctorId: '',
  startTime: '',
  duration: 30,
  type: AppointmentType.CONSULTATION,
  isEmergency: false,
}

/**
 * Books the new patient's first appointment. The doctor's slot is checked
 * against the server (debounced) whenever doctor, time or duration change.
 */
export function useFirstAppointmentForm({
  patientId,
  onDone,
}: {
  patientId: string
  onDone: () => void
}) {
  const createMutation = useCreateAppointment()
  const validateMutation = useValidateAppointment()
  const [validation, setValidation] = useState<ValidationResult | null>(null)

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    validators: {
      onChange: firstAppointmentSchema,
      onSubmit: firstAppointmentSchema,
    },
    onSubmit: async ({ value }) => {
      const payload: AppointmentFormData = {
        patientId,
        doctorId: value.doctorId,
        startTime: new Date(value.startTime).toISOString(),
        duration: value.duration,
        type: value.type,
        notes: '',
        isEmergency: value.isEmergency,
      }
      try {
        await createMutation.mutateAsync(payload)
        toast.success('Appointment booked successfully')
        onDone()
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err.message ||
          'Failed to book appointment'
        toast.error(msg)
      }
    },
  })

  const doctorId = useStore(form.store, (s) => s.values.doctorId)
  const startTime = useStore(form.store, (s) => s.values.startTime)
  const duration = useStore(form.store, (s) => s.values.duration)

  // Real-time slot validation
  useEffect(() => {
    if (!doctorId || !startTime || !duration) {
      setValidation(null)
      return
    }
    const timer = setTimeout(() => {
      validateMutation.mutate(
        {
          doctorId,
          startTime: new Date(startTime).toISOString(),
          duration,
        },
        {
          onSuccess: (result) => setValidation(result),
          onError: () =>
            setValidation({ valid: false, reason: 'Validation failed' }),
        },
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [doctorId, startTime, duration])

  const applySuggestion = () => {
    if (validation?.suggestedStartTime) {
      form.setFieldValue(
        'startTime',
        toDateTimeLocalValue(validation.suggestedStartTime),
      )
    }
  }

  return {
    form,
    validation,
    applySuggestion,
    isPending: createMutation.isPending,
  }
}
