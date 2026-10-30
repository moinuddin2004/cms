import { z } from 'zod'

const int = (label: string, min: number, max?: number) =>
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

const percent = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, `${label}: enter a number (max 2 decimals)`)
    .refine((v) => Number(v) <= 100, `${label} must be between 0 and 100`)

/** Location booking + billing settings (mirrors UpdateLocationSettingsDto). */
export const locationSettingsSchema = z.object({
  appointmentSlotDuration: int('Slot duration', 5, 480),
  maxAppointmentsPerDay: int('Max appointments', 0),
  advanceBookingDays: int('Advance booking', 1, 365),
  cancellationNoticeHours: int('Cancellation notice', 0, 168),
  taxRate: percent('Tax rate'),
  lateFeePercentage: percent('Late fee'),
})

export type LocationSettingsFormValues = z.input<typeof locationSettingsSchema>
