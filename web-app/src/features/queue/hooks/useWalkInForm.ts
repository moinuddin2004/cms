import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { registerWalkIn } from '../services/queue.api'
import type { WalkInPayload } from '../services/queue.api'
import { walkInSchema } from '../schemas/queue.schema'
import type { WalkInFormValues } from '../schemas/queue.schema'
import { printQueueTicket } from '../utils/printTicket'
import { useQueueAction } from './useQueueAction'

/** Why a walk-in was not added straight away. */
export type WalkInNotice =
  | { kind: 'same'; token: string }
  | {
      kind: 'elsewhere'
      message: string
      entries: { token: string; doctorName: string | null }[]
    }

const emptyValues = (doctorId?: string): WalkInFormValues => ({
  mode: 'search',
  patientId: '',
  patientName: '',
  patientPhone: '',
  doctorId: doctorId ?? '',
  reasonForVisit: '',
  urgent: false,
  urgentReason: '',
})

function toPayload(v: WalkInFormValues, force: boolean): WalkInPayload {
  return {
    doctorId: v.doctorId,
    ...(v.mode === 'search'
      ? { patientId: v.patientId }
      : {
          patientName: v.patientName.trim(),
          patientPhone: v.patientPhone.trim(),
        }),
    reasonForVisit: v.reasonForVisit.trim() || undefined,
    urgentReason: v.urgent ? v.urgentReason.trim() : undefined,
    force,
  }
}

/**
 * Walk-in form state + submit. Same doctor's queue already has the patient →
 * `notice.kind === 'same'` (their token is shown, nothing added). Another
 * doctor's queue today → `notice.kind === 'elsewhere'`; `addAnyway()`
 * resubmits with `force`.
 */
export function useWalkInForm({
  open,
  defaultDoctorId,
  onDone,
}: {
  open: boolean
  defaultDoctorId?: string
  onDone: () => void
}) {
  const [notice, setNotice] = useState<WalkInNotice | null>(null)

  const walkIn = useQueueAction(
    (payload: WalkInPayload) => registerWalkIn(payload),
    {
      onError: (err) => {
        if (err.code === 'ALREADY_CHECKED_IN') {
          setNotice({ kind: 'same', token: err.data?.entry?.token ?? '—' })
          return true
        }
        if (err.code === 'ACTIVE_WITH_OTHER_DOCTOR') {
          setNotice({
            kind: 'elsewhere',
            message: err.message,
            entries: err.data?.entries ?? [],
          })
          return true
        }
        return false
      },
    },
  )

  const submit = async (values: WalkInFormValues, force: boolean) => {
    const result = await walkIn
      .mutateAsync(toPayload(values, force))
      .catch(() => null)
    if (!result) return
    toast.success(
      `Token ${result.token} — ${result.entry.patient?.fullName ?? 'walk-in'}`,
      {
        action: {
          label: 'Print ticket',
          onClick: () => void printQueueTicket(result.entry.id),
        },
        duration: 8000,
      },
    )
    onDone()
  }

  const form = useForm({
    defaultValues: emptyValues(defaultDoctorId),
    validators: { onChange: walkInSchema, onSubmit: walkInSchema },
    onSubmit: ({ value }) => submit(value, false),
  })

  // Fresh form each time the sheet opens.
  useEffect(() => {
    if (!open) return
    form.reset(emptyValues(defaultDoctorId))
    setNotice(null)
  }, [open, defaultDoctorId]) // form is stable

  return {
    form,
    notice,
    clearNotice: () => setNotice(null),
    isPending: walkIn.isPending,
    addAnyway: () => submit(form.state.values, true),
  }
}
