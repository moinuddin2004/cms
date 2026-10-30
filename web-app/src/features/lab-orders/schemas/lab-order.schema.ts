import { z } from 'zod'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export const orderItemSchema = z.object({
  id: z.string().optional(),
  labServiceId: z.string().min(1, 'Choose a service'),
  optionIds: z.array(z.string()),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, 'Whole number')
    .refine((v) => Number(v) >= 1 && Number(v) <= 99, 'Between 1 and 99'),
  rush: z.boolean(),
  answers: z.record(z.string(), z.unknown()),
})

/**
 * The order sheet. Drafts aren't validated on the server beyond structure,
 * so this only checks what keeps a draft coherent; the full form check
 * happens at submit (the server returns per-line issues).
 */
export const labOrderSchema = z.object({
  patientId: z.string().min(1, 'Choose the patient'),
  labId: z.string().min(1, 'Choose a lab'),
  doctorId: z.string(),
  priority: z.enum(['normal', 'urgent']),
  requestedOn: z.string().refine((v) => !v || YMD.test(v), 'Pick a date'),
  notes: z.string().trim().max(4000, 'At most 4000 characters'),
  items: z
    .array(orderItemSchema)
    .min(1, 'Add at least one item')
    .max(20, 'At most 20 items'),
})

export type LabOrderFormValues = z.input<typeof labOrderSchema>
export type OrderItemFormValues = LabOrderFormValues['items'][number]

export const revisionSchema = z.object({
  reason: z.string().trim().min(1, 'Say what changed').max(1000),
})

/** Reason for an order status action (backend: required, max 1000). */
export const orderActionReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'A reason is required')
    .max(1000, 'At most 1000 characters'),
})
