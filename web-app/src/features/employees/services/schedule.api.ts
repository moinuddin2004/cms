import api from '@/lib/api'
import type { ScheduleDay } from '../types'

// ─── Schedule ───────────────────────────────────────────────────────

export async function fetchSchedule(
  employeeId: string,
): Promise<ScheduleDay[]> {
  const { data } = await api.get(`/employees/${employeeId}/schedule`)
  return data.data
}

export async function setSchedule(
  employeeId: string,
  payload: {
    slotDuration: number
    schedule: {
      dayOfWeek: number
      isWorking: boolean
      startTime?: string
      endTime?: string
    }[]
  },
): Promise<ScheduleDay[]> {
  const { data } = await api.post(`/employees/${employeeId}/schedule`, payload)
  return data.data
}

export async function updateScheduleDay(
  employeeId: string,
  dayOfWeek: number,
  payload: {
    isWorking: boolean
    startTime?: string
    endTime?: string
  },
): Promise<ScheduleDay> {
  const { data } = await api.patch(
    `/employees/${employeeId}/schedule/${dayOfWeek}`,
    payload,
  )
  return data.data
}
