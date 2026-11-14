import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';
import { clinicDayBounds } from '@/staff/lib/datetime';

import type {
  AppointmentDetail,
  AppointmentFilters,
  AppointmentListItem,
  AppointmentPage,
  AppointmentStats,
  DoctorOption,
} from '../types/appointments.types';

export const APPOINTMENTS_PAGE_SIZE = 50;

/** Safety cap for "load the whole day" (50 × 20 = 1000 bookings). */
const MAX_PAGES = 20;

/**
 * Query params for `GET /appointments` — the backend ValidationPipe rejects
 * unknown params, so only the ones in `AppointmentFilterDto` are built here.
 * Undefined values are dropped by axios. The day is the CLINIC day.
 */
export function appointmentListParams(
  ymd: string,
  filters: AppointmentFilters,
  page: number,
  limit: number = APPOINTMENTS_PAGE_SIZE,
) {
  const { start, end } = clinicDayBounds(ymd);
  return {
    startDate: start,
    endDate: end,
    doctorId: filters.doctorId || undefined,
    status: filters.status || undefined,
    includeWalkIns: filters.includeWalkIns ?? true,
    search: filters.search?.trim() || undefined,
    page,
    limit,
  };
}

/** `GET /appointments` — one page of the clinic day. */
export async function fetchAppointments(
  ymd: string,
  filters: AppointmentFilters,
  page: number,
  limit: number = APPOINTMENTS_PAGE_SIZE,
): Promise<AppointmentPage> {
  const res = await staffApi.get<ApiResponse<AppointmentPage>>('/appointments', {
    params: appointmentListParams(ymd, filters, page, limit),
  });
  return res.data.data;
}

/** Every booking of the day (no walk-ins), paging until `page * limit >= total`. */
export async function fetchAllDayBookings(ymd: string): Promise<AppointmentListItem[]> {
  const rows: AppointmentListItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetchAppointments(ymd, { includeWalkIns: false }, page);
    rows.push(...res.data);
    if (res.page * res.limit >= res.total || res.data.length === 0) break;
  }
  return rows;
}

export async function fetchAppointment(id: string): Promise<AppointmentDetail> {
  const res = await staffApi.get<ApiResponse<AppointmentDetail>>(
    `/appointments/${encodeURIComponent(id)}`,
  );
  return res.data.data;
}

/** `GET /appointments/stats` for one clinic day. */
export async function fetchAppointmentStats(ymd: string): Promise<AppointmentStats> {
  const { start, end } = clinicDayBounds(ymd);
  const res = await staffApi.get<ApiResponse<AppointmentStats>>('/appointments/stats', {
    params: { startDate: start, endDate: end },
  });
  return res.data.data;
}

/** `GET /appointments/doctors` — doctors working at the active location. */
export async function fetchDoctors(): Promise<DoctorOption[]> {
  const res = await staffApi.get<ApiResponse<DoctorOption[]>>('/appointments/doctors');
  return res.data.data;
}
