import { z } from 'zod'
import { intField } from '@/lib/zod-numbers'

const text = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

export const REMAKE_REASONS = [
  'shade',
  'fit',
  'fracture',
  'design',
  'damaged',
  'other',
] as const

/** Reject received work / ask for an after-care remake. */
export const remakeRequestSchema = z.object({
  reasonCode: z.enum(REMAKE_REASONS),
  notes: text(2000).min(1, 'Describe the problem'),
})
export type RemakeRequestValues = z.input<typeof remakeRequestSchema>

/** Agree a remake (who is responsible decides the prices) or close it. */
export const remakeDecisionSchema = z
  .object({
    decision: z.enum(['agree', 'close']),
    responsibleParty: z.enum(['lab', 'clinic', 'patient', 'undetermined']),
    note: text(2000),
  })
  .refine(
    (v) => v.decision === 'close' || v.responsibleParty !== 'undetermined',
    {
      path: ['responsibleParty'],
      message: 'Decide who is responsible before agreeing',
    },
  )
export type RemakeDecisionValues = z.input<typeof remakeDecisionSchema>

/** One received line: quantity in range, missing = nothing received. */
export const receiveLineSchema = z
  .object({
    quantity: z.number().int().min(1),
    receivedQty: intField('Received', { min: 0 }),
    condition: z.enum(['ok', 'damaged', 'missing']),
    qcResult: z.enum(['pass', 'fail', '']),
    qcNotes: text(2000),
  })
  .superRefine((v, ctx) => {
    if (!/^\d+$/.test(v.receivedQty)) return
    const received = Number(v.receivedQty)
    if (v.condition === 'missing' ? received !== 0 : received < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['receivedQty'],
        message:
          v.condition === 'missing'
            ? 'Missing means nothing received'
            : 'At least 1',
      })
    }
    if (received > v.quantity) {
      ctx.addIssue({
        code: 'custom',
        path: ['receivedQty'],
        message: `At most ${v.quantity}`,
      })
    }
  })

export const receiveShipmentSchema = z.object({
  lines: z.array(
    z.object({
      shipmentItemId: z.string(),
      label: z.string(),
      include: z.boolean(),
      line: receiveLineSchema,
    }),
  ),
})
export type ReceiveShipmentValues = z.input<typeof receiveShipmentSchema>

export const SHIPMENT_CONTENTS = [
  'impression',
  'model',
  'framework',
  'tryin',
  'final',
  'other',
] as const

/** Impressions / models / work going from the clinic to the lab. */
export const sendToLabSchema = z
  .object({
    lines: z.array(
      z.object({
        itemId: z.string(),
        label: z.string(),
        include: z.boolean(),
        contents: z.enum(SHIPMENT_CONTENTS),
        quantity: intField('Quantity', { min: 1, max: 64 }),
      }),
    ),
    courierName: text(100),
    trackingNo: text(100),
    notes: text(2000),
  })
  .refine((v) => v.lines.some((l) => l.include), {
    path: ['lines'],
    message: 'Choose at least one item to send',
  })
export type SendToLabValues = z.input<typeof sendToLabSchema>
