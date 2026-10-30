import { z } from 'zod'

/**
 * Book / edit an appointment. Slot conflicts are not checked here — the
 * server validates the doctor's time as the user types (`useValidateAppointment`).
 */
export const appointmentModalSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  startTime: z
    .string()
    .min(1, 'Start time is required')
    .refine(
      (v) => !v || !Number.isNaN(new Date(v).getTime()),
      'Enter a valid date and time',
    ),
  duration: z
    .number()
    .int('Whole minutes only')
    .min(5, 'At least 5 minutes')
    .max(480, 'At most 8 hours'),
  type: z.string().min(1, 'Appointment type is required'),
  notes: z.string(),
  isEmergency: z.boolean(),
})

export type AppointmentModalValues = z.input<typeof appointmentModalSchema>
