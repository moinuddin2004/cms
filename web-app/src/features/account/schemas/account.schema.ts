import { z } from 'zod'

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
  taxRate: z
    .number({ message: 'Enter a number' })
    .min(0, 'Cannot be negative')
    .max(100, 'At most 100%'),
})
export type SetupLocationInput = z.infer<typeof setupLocationSchema>

export const recordPaymentSchema = z.object({
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  months: z
    .number({ message: 'Enter months' })
    .int('Whole months only')
    .min(1, 'At least 1 month')
    .max(36, 'At most 36 months'),
  amount: z
    .number({ message: 'Enter the amount' })
    .min(0, 'Cannot be negative'),
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
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

const optionalLimit = z
  .number()
  .int('Whole number')
  .min(1, 'At least 1')
  .nullable()

export const updateSubscriptionSchema = z.object({
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']),
  trialEndsAt: z.string().nullable(),
  paidUntil: z.string().nullable(),
  maxLocations: optionalLimit,
  maxUsers: optionalLimit,
})
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>

/** Super-admin payment instructions (`PaymentInstructionsDto`: max 2000). */
export const paymentInstructionsSchema = z.object({
  text: z.string().max(2000, 'At most 2000 characters'),
})
