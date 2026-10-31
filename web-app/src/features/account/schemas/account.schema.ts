import { z } from 'zod'
import { decimalField, intField, moneyField } from '@/lib/zod-numbers'

const optionalText = (max: number) =>
  z.string().trim().max(max, `At most ${max} characters`)

export const setupClinicSchema = z.object({
  name: z.string().trim().min(2, 'Enter your clinic name').max(255),
  phone: optionalText(20),
  email: z
    .string()
    .trim()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: 'Enter a valid email',
    }),
  website: optionalText(500),
  specialtyTags: z.array(z.string()).min(1, 'Pick at least one'),
  timezone: z.string().min(1, 'Pick a timezone'),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use a 3-letter code, e.g. PKR'),
})
export type SetupClinicInput = z.infer<typeof setupClinicSchema>

export const setupLocationSchema = z.object({
  name: z.string().trim().min(2, 'Enter a location name').max(255),
  address: optionalText(1000),
  city: optionalText(100),
  phone: optionalText(20),
  email: z
    .string()
    .trim()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: 'Enter a valid email',
    }),
  taxRate: decimalField('Tax rate', { max: 100 }),
})
/** Form values: the tax rate is edited as text. */
export type SetupLocationFormValues = z.input<typeof setupLocationSchema>
/** API payload. */
export type SetupLocationInput = Omit<SetupLocationFormValues, 'taxRate'> & {
  taxRate: number
}

export const recordPaymentSchema = z.object({
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  months: intField('Months', { min: 1, max: 36 }),
  amount: moneyField('Amount'),
  method: z.enum([
    'bank_transfer',
    'jazzcash',
    'easypaisa',
    'cash',
    'cheque',
    'other',
  ]),
  reference: optionalText(120),
  paidAt: z.string().min(1, 'Pick the payment date'),
  notes: optionalText(1000),
})
/** Form values: months and amount are edited as text. */
export type RecordPaymentFormValues = z.input<typeof recordPaymentSchema>
/** API payload. */
export type RecordPaymentInput = Omit<
  RecordPaymentFormValues,
  'months' | 'amount'
> & { months: number; amount: number }

export const updateSubscriptionSchema = z.object({
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  trialEndsAt: z.string().nullable(),
  paidUntil: z.string().nullable(),
  // '' = use the plan default.
  maxLocations: intField('Location limit', { min: 1, required: false }),
  maxUsers: intField('Login limit', { min: 1, required: false }),
})
/** Form values: limits are edited as text. */
export type UpdateSubscriptionFormValues = z.input<
  typeof updateSubscriptionSchema
>
/** API payload (null limit = plan default). */
export type UpdateSubscriptionInput = Omit<
  UpdateSubscriptionFormValues,
  'maxLocations' | 'maxUsers'
> & { maxLocations: number | null; maxUsers: number | null }

/** Super-admin payment instructions (`PaymentInstructionsDto`: max 2000). */
export const paymentInstructionsSchema = z.object({
  text: z.string().max(2000, 'At most 2000 characters'),
})
