import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { answersToSend, readFields } from '@/features/engine-studio'
import { labOrderSchema } from '../schemas/lab-order.schema'
import type {
  LabOrderFormValues,
  OrderItemFormValues,
} from '../schemas/lab-order.schema'
import { orderError } from '../lib/order-errors'
import { labOrdersApi, newIdempotencyKey } from '../services/lab-orders.api'
import type { LabOrderDetail, OrderInput, OrderIssue } from '../types'
import { useOrderMutation } from './useLabOrders'

export const emptyOrderItem = (): OrderItemFormValues => ({
  labServiceId: '',
  optionIds: [],
  quantity: '1',
  rush: false,
  answers: {},
})

function defaults(order: LabOrderDetail | null): LabOrderFormValues {
  return {
    patientId: order?.patient.id ?? '',
    labId: order?.lab.id ?? '',
    doctorId: order?.doctor?.id ?? '',
    priority: order?.priority ?? 'normal',
    requestedOn: order?.requestedOn ?? '',
    notes: order?.notes ?? '',
    items: order
      ? order.items.map((i) => ({
          id: i.id,
          labServiceId: i.labServiceId,
          optionIds: i.optionIds,
          quantity: String(i.quantity),
          rush: i.rush,
          answers: i.answers,
        }))
      : [emptyOrderItem()],
  }
}

/** Answers worth sending: only visible, filled fields of the line's form. */
function cleanAnswers(
  answers: Record<string, unknown>,
  schemaJson: unknown,
): Record<string, unknown> {
  return schemaJson ? answersToSend(readFields(schemaJson), answers) : {}
}

export type SaveIntent = 'draft' | 'submit'

/**
 * Create / edit a draft lab order and optionally submit it. Each press of
 * "Submit" reuses one Idempotency-Key until it succeeds, so a retry after a
 * network error never makes a second order (lab ERD inv. 10).
 */
export function useLabOrderForm({
  open,
  order,
  formFor,
  onDone,
}: {
  open: boolean
  order: LabOrderDetail | null
  /** The service's form schema JSON (to drop hidden answers). */
  formFor: (labServiceId: string) => unknown
  onDone: (order: LabOrderDetail) => void
}) {
  const [issues, setIssues] = useState<OrderIssue[]>([])
  const intent = useRef<SaveIntent>('draft')
  const keys = useRef({
    create: newIdempotencyKey(),
    submit: newIdempotencyKey(),
  })
  const draftId = useRef<string | null>(order?.id ?? null)
  const save = useOrderMutation(
    async (value: LabOrderFormValues) => {
      const body: OrderInput = {
        patientId: value.patientId,
        labId: value.labId,
        doctorId: value.doctorId || null,
        priority: value.priority,
        requestedOn: value.requestedOn || null,
        notes: value.notes.trim() || null,
        items: value.items.map((i) => ({
          ...(i.id ? { id: i.id } : {}),
          labServiceId: i.labServiceId,
          optionIds: i.optionIds,
          quantity: Number(i.quantity),
          rush: i.rush,
          answers: cleanAnswers(i.answers, formFor(i.labServiceId)),
        })),
      }
      let saved: LabOrderDetail
      if (draftId.current) {
        const current = await labOrdersApi.get(draftId.current)
        const { patientId: _p, labId: _l, ...rest } = body
        saved = await labOrdersApi.update(draftId.current, {
          ...rest,
          version: current.version,
        })
      } else {
        saved = await labOrdersApi.create(body, keys.current.create)
        draftId.current = saved.id
      }
      if (intent.current === 'submit') {
        saved = await labOrdersApi.submit(
          saved.id,
          saved.version,
          keys.current.submit,
        )
      }
      return saved
    },
    {
      success: (o) =>
        o.orderNo ? `Order ${o.orderNo} sent to ${o.lab.name}` : 'Draft saved',
      silentError: true,
    },
  )

  const form = useForm({
    defaultValues: defaults(order),
    validators: { onChange: labOrderSchema, onSubmit: labOrderSchema },
    onSubmit: async ({ value }) => {
      setIssues([])
      try {
        const saved = await save.mutateAsync(value)
        keys.current = {
          create: newIdempotencyKey(),
          submit: newIdempotencyKey(),
        }
        onDone(saved)
      } catch (err) {
        const e = orderError(err)
        setIssues(
          e.issues.length
            ? e.issues
            : [
                {
                  line: null,
                  path: '',
                  code: e.code ?? 'error',
                  message: e.message,
                },
              ],
        )
      }
    },
  })

  useEffect(() => {
    if (open) {
      form.reset(defaults(order))
      draftId.current = order?.id ?? null
      setIssues([])
    }
  }, [open, order, form])

  const run = (next: SaveIntent) => {
    intent.current = next
    void form.handleSubmit()
  }
  return { form, issues, run, isEditing: !!order }
}
