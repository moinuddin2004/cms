import { z } from 'zod'
import { AppointmentType } from '@/features/appointments/types'

/**
 * "Book first appointment" step after creating a patient. Slot conflicts are
 * checked by the server as the user picks (`useValidateAppointment`).
 */
export const firstAppointmentSchema = z.object({
  doctorId: z.string().min(1, 'Please select a doctor'),
  startTime: z
    .string()
    .min(1, 'Please select an appointment time')
    .refine(
      (v) => !v || !Number.isNaN(new Date(v).getTime()),
      'Enter a valid date and time',
    ),
  duration: z.number().int().positive('Please select a duration'),
  type: z.enum(AppointmentType, { message: 'Select an appointment type' }),
  isEmergency: z.boolean(),
})

export type FirstAppointmentFormValues = z.input<typeof firstAppointmentSchema>
