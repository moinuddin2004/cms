import { z } from 'zod'
import { rupeesToMinor } from '../lib/money'

const max = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

const code = z
  .string()
  .trim()
  .min(1, 'Code is required')
  .regex(
    /^[A-Za-z][A-Za-z0-9_]{0,49}$/,
    'Letters, digits and _ only, starting with a letter',
  )

const rupees = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine(
      (v) => rupeesToMinor(v) !== null,
      'Enter an amount like 4500 or 4500.50',
    )

const optionalRupees = z
  .string()
  .trim()
  .refine(
    (v) => !v || rupeesToMinor(v) !== null,
    'Enter an amount like 500 or 500.50',
  )

const ymd = /^\d{4}-\d{2}-\d{2}$/

/** A lab service (platform admin). The code is fixed after creation. */
export const labServiceSchema = z.object({
  categoryId: z.string().min(1, 'Choose a category'),
  code,
  name: max(150).min(1, 'Name is required'),
  description: max(1000),
  unitType: z.enum(['per_tooth', 'per_unit', 'per_arch', 'per_case']),
  defaultTurnaroundDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Enter whole days')
    .refine((v) => Number(v) <= 365, 'At most 365 days'),
  formSchemaId: z.string(),
  workflowTemplateId: z.string(),
  stageTemplateId: z.string(),
})

export type LabServiceFormValues = z.input<typeof labServiceSchema>

export const serviceOptionSchema = z.object({
  optionType: z.enum(['material', 'variant']),
  code,
  name: max(150).min(1, 'Name is required'),
  extraCost: rupees('Extra cost'),
})

export type ServiceOptionFormValues = z.input<typeof serviceOptionSchema>

/** A price window. `organizationId` '' = the lab's list price. */
export const priceSchema = z
  .object({
    organizationId: z.string(),
    unitPrice: rupees('Price'),
    rushSurcharge: optionalRupees,
    effectiveFrom: z.string().regex(ymd, 'Pick the start date'),
    effectiveTo: z.string().refine((v) => !v || ymd.test(v), 'Pick a date'),
    notes: max(500),
  })
  .superRefine((v, ctx) => {
    if (v.effectiveTo && v.effectiveFrom && v.effectiveTo < v.effectiveFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'Must be on or after the start date',
      })
    }
  })

export type PriceFormValues = z.input<typeof priceSchema>

export const voidPriceSchema = z.object({
  reason: max(500).min(1, 'A reason is required'),
})

export const mappingSchema = z.object({
  clinicTreatmentId: z.string().min(1, 'Choose a treatment'),
  labServiceId: z.string().min(1, 'Choose a lab service'),
  isDefault: z.boolean(),
})

export type MappingFormValues = z.input<typeof mappingSchema>

export const templateItemSchema = z.object({
  labServiceId: z.string().min(1, 'Choose a service'),
  optionIds: z.array(z.string()),
  quantity: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, 'Whole number')
    .refine((v) => Number(v) >= 1 && Number(v) <= 32, 'Between 1 and 32'),
  rush: z.boolean(),
  answers: z.record(z.string(), z.unknown()),
})

export const orderTemplateSchema = z.object({
  name: max(150).min(1, 'Name is required'),
  shared: z.boolean(),
  notes: max(1000),
  items: z
    .array(templateItemSchema)
    .min(1, 'Add at least one service')
    .max(20, 'At most 20 services'),
})

export type OrderTemplateFormValues = z.input<typeof orderTemplateSchema>
