import { z } from 'zod'

/** A whole number typed as a string, within [min, max]. */
export const intInRange = (label: string, min: number, max?: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label}: enter a whole number`)
    .refine(
      (v) => Number(v) >= min && (max === undefined || Number(v) <= max),
      max === undefined
        ? `${label} must be at least ${min}`
        : `${label} must be between ${min} and ${max}`,
    )

/** Org booking defaults (mirrors UpdateOrganizationSettingsDto). */
export const organizationSettingsSchema = z.object({
  allowLocationOverride: z.boolean(),
  defaultSlotDuration: intInRange('Slot duration', 5, 480),
  advanceBookingDays: intInRange('Advance booking', 1, 365),
  cancellationNoticeHours: intInRange('Cancellation notice', 0, 168),
})

export type OrganizationSettingsFormValues = z.input<
  typeof organizationSettingsSchema
>
