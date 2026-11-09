import { z } from 'zod'
import { intField } from '@/lib/zod-numbers'

/** Org booking defaults (mirrors UpdateOrganizationSettingsDto). */
export const organizationSettingsSchema = z.object({
  allowLocationOverride: z.boolean(),
  defaultSlotDuration: intField('Slot duration', { min: 5, max: 480 }),
  advanceBookingDays: intField('Advance booking', { min: 1, max: 365 }),
  cancellationNoticeHours: intField('Cancellation notice', {
    min: 0,
    max: 168,
  }),
})

export type OrganizationSettingsFormValues = z.input<
  typeof organizationSettingsSchema
>
