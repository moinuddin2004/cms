import { useState } from 'react'
import { toast } from 'sonner'
import { useQueueAction } from '@/features/queue/hooks/useQueueAction'
import { registerWalkIn } from '@/features/queue/services/queue.api'

/**
 * Puts the just-registered patient straight into a doctor's queue (walk-in)
 * instead of booking a slot. "Already in a queue" answers come back as a
 * plain message; the caller can then resubmit with `force`.
 */
export function useFirstWalkIn({
  patientId,
  onDone,
}: {
  patientId: string
  onDone: () => void
}) {
  const [doctorId, setDoctorId] = useState('')
  const [reason, setReason] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [urgentReason, setUrgentReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const mutation = useQueueAction(
    (force: boolean) =>
      registerWalkIn({
        doctorId,
        patientId,
        reasonForVisit: reason.trim() || undefined,
        urgentReason: urgent ? urgentReason.trim() : undefined,
        force,
      }),
    {
      onError: (err) => {
        if (
          err.code === 'ALREADY_CHECKED_IN' ||
          err.code === 'ACTIVE_WITH_OTHER_DOCTOR'
        ) {
          setMessage(err.message)
          return true
        }
        return false
      },
    },
  )

  const submit = async (force = false) => {
    setMessage(null)
    const result = await mutation.mutateAsync(force).catch(() => null)
    if (!result) return
    toast.success(
      `Token ${result.token} — ${result.entry.patient?.fullName ?? 'walk-in'}`,
    )
    onDone()
  }

  const canSubmit = !!doctorId && (!urgent || urgentReason.trim().length > 0)

  return {
    doctorId,
    setDoctorId,
    reason,
    setReason,
    urgent,
    setUrgent,
    urgentReason,
    setUrgentReason,
    message,
    canSubmit,
    isPending: mutation.isPending,
    submit,
  }
}
