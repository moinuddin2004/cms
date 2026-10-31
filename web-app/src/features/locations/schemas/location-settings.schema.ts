import { z } from 'zod'
import { decimalField, intField } from '@/lib/zod-numbers'

const percent = (label: string) => decimalField(label, { min: 0, max: 100 })

/** Location booking + billing settings (mirrors UpdateLocationSettingsDto). */
export const locationSettingsSchema = z.object({
  appointmentSlotDuration: intField('Slot duration', { min: 5, max: 480 }),
  maxAppointmentsPerDay: intField('Max appointments', { min: 0 }),
  advanceBookingDays: intField('Advance booking', { min: 1, max: 365 }),
  cancellationNoticeHours: intField('Cancellation notice', { min: 0, max: 168 }),
  taxRate: percent('Tax rate'),
  lateFeePercentage: percent('Late fee'),
})

export type LocationSettingsFormValues = z.input<typeof locationSettingsSchema>
