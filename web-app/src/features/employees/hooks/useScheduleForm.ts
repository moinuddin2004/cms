import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { scheduleFormSchema } from '../schemas/schedule.schema'
import type { ScheduleFormValues } from '../schemas/schedule.schema'
import type { ScheduleDay } from '../types'
import { useSetSchedule } from './useSetSchedule'

const isWeekday = (i: number) => i >= 1 && i <= 5

/** Mon–Fri 09:00–17:00, 30-minute slots. */
const DEFAULTS: ScheduleFormValues = {
  slotDuration: '30',
  days: Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek: i,
    isWorking: isWeekday(i),
    startTime: isWeekday(i) ? '09:00' : '',
    endTime: isWeekday(i) ? '17:00' : '',
  })),
}

const SLOTS = ['15', '30', '45', '60'] as const
type Slot = (typeof SLOTS)[number]
const asSlot = (n: number | undefined): Slot =>
  SLOTS.find((s) => Number(s) === n) ?? '30'

// Postgres `time` columns come back as "HH:MM:SS"; the API only accepts HH:MM.
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

function defaultsFrom(server: ScheduleDay[] | undefined): ScheduleFormValues {
  if (!server || server.length !== 7) return DEFAULTS
  const firstWorking = server.find((d) => d.isWorking)
  return {
    slotDuration: asSlot(firstWorking?.slotDuration),
    days: [...server]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isWorking: d.isWorking,
        startTime: d.isWorking ? hhmm(d.startTime) || '09:00' : '',
        endTime: d.isWorking ? hhmm(d.endTime) || '17:00' : '',
      })),
  }
}

/** Weekly work schedule for one employee at the active location. */
export function useScheduleForm(
  employeeId: string,
  serverSchedule: ScheduleDay[] | undefined,
) {
  const save = useSetSchedule(employeeId)

  const form = useForm({
    defaultValues: defaultsFrom(serverSchedule),
    validators: { onChange: scheduleFormSchema, onSubmit: scheduleFormSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await save.mutateAsync({
          slotDuration: Number(value.slotDuration),
          schedule: value.days.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            isWorking: d.isWorking,
            startTime: d.isWorking ? d.startTime : undefined,
            endTime: d.isWorking ? d.endTime : undefined,
          })),
        })
        // Saved values become the new baseline (clears dirty state).
        formApi.reset(value)
      } catch {
        // Toasted by useSetSchedule's onError.
      }
    },
  })

  useEffect(() => {
    if (serverSchedule && serverSchedule.length === 7)
      form.reset(defaultsFrom(serverSchedule))
  }, [serverSchedule, form])

  return form
}
