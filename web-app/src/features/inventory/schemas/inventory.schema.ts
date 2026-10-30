import { z } from 'zod'
import { ITEM_UNITS } from '../types'

/** decimal(10,2) columns top out just under 100 million. */
const MAX_AMOUNT = 99_999_999.99

const max = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

const required = (label: string, n = 255) =>
  max(n).min(1, `${label} is required`)

/**
 * A number typed into an input, kept as a string in form values and
 * converted in onSubmit. Empty is allowed unless `required`.
 */
function numberString({
  required: isRequired = false,
  min = 0,
  minMessage,
  max: upper = MAX_AMOUNT,
  maxMessage,
}: {
  required?: boolean
  min?: number
  minMessage?: string
  max?: number
  maxMessage?: string
} = {}) {
  return z
    .string()
    .trim()
    .superRefine((v, ctx) => {
      if (!v) {
        if (isRequired) ctx.addIssue({ code: 'custom', message: 'Required' })
        return
      }
      const n = Number(v)
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid number' })
        return
      }
      if (n < min) {
        ctx.addIssue({
          code: 'custom',
          message: minMessage ?? `Must be ${min} or more`,
        })
        return
      }
      if (n > upper) {
        ctx.addIssue({
          code: 'custom',
          message: maxMessage ?? `Must be at most ${upper.toLocaleString()}`,
        })
        return
      }
      if (/\.\d{3,}$/.test(v)) {
        ctx.addIssue({ code: 'custom', message: 'At most 2 decimal places' })
      }
    })
}

const phoneRe = /^\+?[0-9][0-9\s-]{6,18}$/

// ─── Item ───────────────────────────────────────────────────────────
export const itemSchema = z.object({
  name: required('Name'),
  sku: max(100),
  categoryId: z.string(),
  /** Create only — ignored when editing. */
  initialStock: numberString({ required: true }),
  unit: z.enum(ITEM_UNITS),
  unitPrice: numberString({ required: true }),
  sellingPrice: numberString(),
  reorderLevel: numberString({ required: true }),
  expiryDate: z.string(),
  description: max(2000),
  isBillable: z.boolean(),
})

export type ItemFormValues = z.input<typeof itemSchema>

// ─── Supplier ───────────────────────────────────────────────────────
export const supplierSchema = z.object({
  name: required('Name'),
  contactPerson: max(255),
  phone: max(30).refine(
    (v) => !v || phoneRe.test(v),
    'Enter a valid phone number',
  ),
  email: max(255).refine(
    (v) => !v || z.email().safeParse(v).success,
    'Enter a valid email',
  ),
  address: max(500),
  city: max(100),
  website: max(255),
  notes: max(2000),
})

export type SupplierFormValues = z.input<typeof supplierSchema>

// ─── Purchase order ─────────────────────────────────────────────────
export const poLineSchema = z.object({
  inventoryItemId: z.string().min(1),
  name: z.string(),
  unit: z.string(),
  orderedQuantity: numberString({
    required: true,
    min: 1,
    minMessage: 'At least 1',
  }),
  unitPrice: numberString({ required: true }),
})

export const createPOSchema = z.object({
  supplierId: z.string().min(1, 'Select a supplier'),
  expectedDeliveryDate: z.string(),
  taxRate: numberString({
    required: true,
    max: 100,
    maxMessage: 'At most 100%',
  }),
  notes: max(2000),
  items: z.array(poLineSchema).min(1, 'Add at least one item'),
})

export type CreatePOFormValues = z.input<typeof createPOSchema>
export type POLineValues = CreatePOFormValues['items'][number]

export const receiveLineSchema = z
  .object({
    poItemId: z.string(),
    name: z.string(),
    /** ordered − already received, for the "at most" rule */
    remaining: z.number(),
    receivedQuantity: numberString({ required: true }),
    batchNumber: max(100),
    expiryDate: z.string(),
  })
  .superRefine((v, ctx) => {
    const n = Number(v.receivedQuantity)
    if (v.receivedQuantity.trim() && n > v.remaining) {
      ctx.addIssue({
        code: 'custom',
        path: ['receivedQuantity'],
        message: `Only ${v.remaining} remaining`,
      })
    }
  })

export const receivePOSchema = z
  .object({ items: z.array(receiveLineSchema) })
  .superRefine((v, ctx) => {
    if (!v.items.some((i) => Number(i.receivedQuantity) > 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Enter at least one quantity to receive',
      })
    }
  })

export type ReceivePOFormValues = z.input<typeof receivePOSchema>

// ─── Consumption template ───────────────────────────────────────────
export const templateLineSchema = z.object({
  inventoryItemId: z.string().min(1),
  name: z.string(),
  unit: z.string(),
  quantity: numberString({
    required: true,
    min: 0.01,
    minMessage: 'Must be more than 0',
  }),
  notes: max(500),
})

export const templateSchema = z.object({
  name: required('Template name'),
  procedureName: required('Procedure'),
  appointmentType: z.string(),
  items: z.array(templateLineSchema).min(1, 'Add at least one item'),
})

export type TemplateFormValues = z.input<typeof templateSchema>
export type TemplateLineValues = TemplateFormValues['items'][number]

// ─── Stock adjustment ───────────────────────────────────────────────
export const ADJUST_MOVEMENT_TYPES = [
  'MANUAL_ADJUSTMENT',
  'WASTAGE',
  'RETURN_TO_SUPPLIER',
  'TRANSFER_IN',
  'TRANSFER_OUT',
] as const

export type AdjustMovementType = (typeof ADJUST_MOVEMENT_TYPES)[number]

const adjustStockBase = z.object({
  movementType: z.enum(ADJUST_MOVEMENT_TYPES),
  quantity: numberString({
    required: true,
    min: 0.01,
    minMessage: 'Enter a quantity greater than zero',
  }),
  direction: z.enum(['increase', 'decrease']),
  batchNumber: max(100),
  expiryDate: z.string(),
  notes: max(1000),
})

export type AdjustStockFormValues = z.input<typeof adjustStockBase>

/** Signed change a movement makes to stock (positive = in). */
export function signedAdjustment(v: AdjustStockFormValues): number {
  const qty = Math.abs(Number(v.quantity) || 0)
  if (v.movementType === 'MANUAL_ADJUSTMENT')
    return v.direction === 'decrease' ? -qty : qty
  if (
    v.movementType === 'WASTAGE' ||
    v.movementType === 'RETURN_TO_SUPPLIER' ||
    v.movementType === 'TRANSFER_OUT'
  )
    return -qty
  return qty
}

export const notesRequiredFor = (t: AdjustMovementType) =>
  t === 'WASTAGE' || t === 'MANUAL_ADJUSTMENT'

/** Needs the item's current stock so it can refuse going below zero. */
export function makeAdjustStockSchema(currentStock: number) {
  return adjustStockBase.superRefine((v, ctx) => {
    if (notesRequiredFor(v.movementType) && !v.notes.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['notes'],
        message: 'Notes are required for this adjustment type',
      })
    }
    if (currentStock + signedAdjustment(v) < 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Adjustment would take stock below zero',
      })
    }
  })
}

// ─── Patient consumption ────────────────────────────────────────────
export const consumptionLineSchema = z
  .object({
    inventoryItemId: z.string().min(1),
    name: z.string(),
    unit: z.string(),
    unitPrice: z.number(),
    available: z.number(),
    quantity: numberString({
      required: true,
      min: 0.01,
      minMessage: 'Must be more than 0',
    }),
    wasFromTemplate: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (Number(v.quantity) > v.available) {
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Insufficient stock!',
      })
    }
  })

export const consumptionSchema = z.object({
  templateId: z.string(),
  notes: max(2000),
  lines: z.array(consumptionLineSchema).min(1, 'Add at least one item'),
})

export type ConsumptionFormValues = z.input<typeof consumptionSchema>
export type ConsumptionLineValues = ConsumptionFormValues['lines'][number]
