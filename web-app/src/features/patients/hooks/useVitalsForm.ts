import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { vitalsSchema } from '../schemas/patient-records.schema'
import type {
  VitalKey,
  VitalsFormValues,
} from '../schemas/patient-records.schema'
import { useCreateVitals } from './usePatientSubEntities'

const defaultValues: VitalsFormValues = {
  bpSystolic: '',
  bpDiastolic: '',
  pulseRate: '',
  temperature: '',
  oxygenSaturation: '',
  weightKg: '',
  heightCm: '',
  notes: '',
}

const num = (v: string) => (v.trim() === '' ? undefined : Number(v))

/** Record a set of vitals. Every vital is optional, but at least one is needed. */
export function useVitalsForm({
  patientId,
  onSaved,
}: {
  patientId: string
  onSaved?: () => void
}) {
  const { mutate, isPending } = useCreateVitals()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues,
    validators: { onChange: vitalsSchema, onSubmit: vitalsSchema },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) {
        toast.error('Your session is missing — please sign in again.')
        return
      }
      const { notes, ...raw } = value
      const vitals = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, num(v)]),
      ) as Record<VitalKey, number | undefined>
      if (Object.values(vitals).every((v) => v === undefined)) {
        toast.error('Enter at least one vital before saving.')
        return
      }
      mutate(
        {
          patientId,
          ...vitals,
          notes: notes.trim() || undefined,
          recordedBy: user.uuid,
        },
        {
          onSuccess: () => {
            form.reset()
            onSaved?.()
          },
        },
      )
    },
  })

  return { form, isPending }
}
