import { z } from 'zod'

/** Values of the backend `SubscriptionPlan` enum. */
export const SUBSCRIPTION_PLANS = [
  'free',
  'starter',
  'professional',
  'enterprise',
] as const

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]

/** Organization create / edit (mirrors Create/UpdateOrganizationDto). */
export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'At most 255 characters'),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLANS, 'Choose a plan'),
})

export type OrganizationFormValues = z.input<typeof organizationSchema>
