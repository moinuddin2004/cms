import { z } from 'zod'
import { intField, moneyField } from '@/lib/zod-numbers'
import { discountKindField, refineDiscount } from '@/features/treatment-plans'
import { PlanTemplateCategory } from '../types'

const max = (n: number) => z.string().max(n, `At most ${n} characters`)

/** One service row; the price comes from the catalog. */
const itemSchema = z.object({
  serviceId: z.string().min(1, 'Choose a service'),
  /** Name of a predefined step not linked yet — a hint for picking. */
  procedureName: z.string(),
  estimatedSessions: intField('Sessions', { min: 1, max: 60 }),
})

/** Create / edit a treatment plan template. */
export const planTemplateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(200, 'At most 200 characters'),
    category: z.enum(PlanTemplateCategory),
    description: max(1000),
    items: z
      .array(itemSchema)
      .min(1, 'Add at least one service')
      .max(50, 'At most 50 services'),
    discountKind: discountKindField,
    discountValue: moneyField('Discount', { required: false }),
  })
  .superRefine(refineDiscount)

export type PlanTemplateFormValues = z.input<typeof planTemplateSchema>
export type PlanTemplateItemValues = PlanTemplateFormValues['items'][number]
