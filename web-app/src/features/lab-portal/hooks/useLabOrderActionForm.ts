import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  acceptOrderSchema,
  clarifyOrderSchema,
  expectedDateSchema,
  rejectOrderSchema,
} from '../schemas/lab-order-actions.schema'
import type { LabOrderActionValues } from '../schemas/lab-order-actions.schema'
import type { LabActionsApi, LabOrderAction } from '../types'

const SCHEMA = {
  accept: acceptOrderSchema,
  reject: rejectOrderSchema,
  request_clarification: clarifyOrderSchema,
  change_expected_date: expectedDateSchema,
} as const

const empty = (labExpectedOn: string | null): LabOrderActionValues => ({
  labExpectedOn: labExpectedOn ?? '',
  note: '',
  reason: '',
  body: '',
})

/**
 * One lab answer (accept / reject / ask / move date) as a form: the action
 * picks the schema, `api` decides the route (portal, magic link, proxy).
 */
export function useLabOrderActionForm({
  action,
  api,
  version,
  labExpectedOn,
  onDone,
}: {
  action: LabOrderAction | null
  api: LabActionsApi
  version?: number
  labExpectedOn: string | null
  onDone: () => void
}) {
  const schema = SCHEMA[action ?? 'accept']
  const form = useForm({
    defaultValues: empty(labExpectedOn),
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      try {
        await send(value)
        onDone()
      } catch {
        // The api wrapper toasts the error; keep the dialog open to retry.
      }
    },
  })

  async function send(value: LabOrderActionValues) {
    if (action === 'accept') {
      await api.accept({
        labExpectedOn: value.labExpectedOn,
        note: value.note.trim() || undefined,
        version,
      })
    } else if (action === 'reject') {
      await api.reject({ reason: value.reason.trim(), version })
    } else if (action === 'request_clarification') {
      await api.clarify({ body: value.body.trim() })
    } else if (action === 'change_expected_date') {
      await api.changeExpectedDate?.({
        labExpectedOn: value.labExpectedOn,
        reason: value.reason.trim(),
        version,
      })
    }
  }

  useEffect(() => {
    if (action) form.reset(empty(labExpectedOn))
  }, [action, labExpectedOn, form])

  return form
}
