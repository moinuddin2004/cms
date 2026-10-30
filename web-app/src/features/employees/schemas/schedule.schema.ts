import { z } from 'zod'

// Mirrors SetScheduleDto / ScheduleDayDto + the service's working-day checks.

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const scheduleFormSchema = z.object({
  slotDuration: z.enum(['15', '30', '45', '60'], 'Choose a slot length'),
  days: z
    .array(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          isWorking: z.boolean(),
          // '' on days off.
          startTime: z.string(),
          endTime: z.string(),
        })
        .superRefine((d, ctx) => {
          if (!d.isWorking) return
          const startOk = HHMM.test(d.startTime)
          const endOk = HHMM.test(d.endTime)
          if (!startOk) {
            ctx.addIssue({
              code: 'custom',
              path: ['startTime'],
              message: d.startTime ? 'Use HH:MM' : 'Start time is required',
            })
          }
          if (!endOk) {
            ctx.addIssue({
              code: 'custom',
              path: ['endTime'],
              message: d.endTime ? 'Use HH:MM' : 'End time is required',
            })
          }
          if (
            startOk &&
            endOk &&
            toMinutes(d.endTime) <= toMinutes(d.startTime)
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['endTime'],
              message: 'End time must be after start time',
            })
          }
        }),
    )
    .length(7, 'The schedule must cover all 7 days'),
})

export type ScheduleFormValues = z.input<typeof scheduleFormSchema>
