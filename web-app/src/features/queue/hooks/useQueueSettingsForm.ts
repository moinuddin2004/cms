import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { toInputValue, toNumber, toNumberOrNull } from '@/lib/zod-numbers'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  removeLocationOverride,
  updateQueuePolicies,
} from '../services/queue.api'
import { queuePolicySchema } from '../schemas/queue.schema'
import type { QueuePolicyFormValues } from '../schemas/queue.schema'
import type { QueuePolicySettings } from '../types'
import { queueError } from '../utils/queueError'
import { QUEUE_KEY, useQueuePolicies } from './useQueueData'

const DEFAULTS: QueuePolicyFormValues = {
  scope: 'location',
  smartQueueEnabled: false,
  earlyWindowMin: '15',
  lateGraceMin: '10',
  maxLateMin: '45',
  walkinStarvationMin: '45',
  skippedRejoinPolicy: 'end',
  callTimeoutSec: '',
  manualSelectReasonRequired: false,
  serviceDayCutoff: '00:00',
}

function fromSettings(data: QueuePolicySettings): QueuePolicyFormValues {
  const e = data.effective
  return {
    scope: 'location',
    smartQueueEnabled: e.smartQueueEnabled,
    earlyWindowMin: toInputValue(e.earlyWindowMin),
    lateGraceMin: toInputValue(e.lateGraceMin),
    maxLateMin: toInputValue(e.maxLateMin),
    walkinStarvationMin: toInputValue(e.walkinStarvationMin),
    skippedRejoinPolicy: e.skippedRejoinPolicy,
    callTimeoutSec: toInputValue(e.callTimeoutSec),
    manualSelectReasonRequired: e.manualSelectReasonRequired,
    serviceDayCutoff: e.serviceDayCutoff,
  }
}

/**
 * Queue settings form for the active location: loads what currently applies,
 * saves as this location's override or the organization default (with
 * optimistic-lock version), and can drop the override.
 */
export function useQueueSettingsForm() {
  const { data, isLoading } = useQueuePolicies()
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: (v: QueuePolicyFormValues) => {
      const target =
        v.scope === 'organization'
          ? data?.organizationDefault
          : data?.locationOverride
      return updateQueuePolicies({
        ...v,
        earlyWindowMin: toNumber(v.earlyWindowMin),
        lateGraceMin: toNumber(v.lateGraceMin),
        maxLateMin: toNumber(v.maxLateMin),
        walkinStarvationMin: toNumber(v.walkinStarvationMin),
        callTimeoutSec: toNumberOrNull(v.callTimeoutSec),
        version: target?.version,
      })
    },
    onSuccess: () => {
      toast.success("Queue settings saved — they apply from tomorrow's queues")
      void queryClient.invalidateQueries({ queryKey: [QUEUE_KEY] })
    },
    onError: (e) => toast.error(queueError(e).message),
  })

  const removeOverride = useMutation({
    mutationFn: removeLocationOverride,
    onSuccess: () => {
      toast.success('This location now uses the organization default')
      void queryClient.invalidateQueries({ queryKey: [QUEUE_KEY] })
    },
    onError: (e) => toast.error(queueError(e).message),
  })

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: queuePolicySchema, onSubmit: queuePolicySchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value)
      form.reset(value)
    },
  })

  // Load what currently applies into the form (also clears dirty state).
  useEffect(() => {
    if (data) form.reset(fromSettings(data))
  }, [data]) // form is stable

  return { form, data, isLoading, removeOverride }
}
