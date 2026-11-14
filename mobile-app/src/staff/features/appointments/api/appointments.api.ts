import { log } from '@/core/log';
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

/** Safety cap for "load the whole day": 20 pages × 50 = 1000 bookings. Hitting it is logged. */
export const MAX_DAY_PAGES = 20;

/** UTC ISO bounds of a range filter. */
export interface UtcRange {
  start: string;
  end: string;
}

/**
 * Query params for `GET /appointments` — the backend ValidationPipe rejects
 * unknown params, so only the ones in `AppointmentFilterDto` are built here.
 * Undefined values are dropped by axios.
 */
export function appointmentRangeParams(
  range: UtcRange,
  filters: AppointmentFilters,
  page: number,
  limit: number = APPOINTMENTS_PAGE_SIZE,
) {
  return {
    startDate: range.start,
    endDate: range.end,
    doctorId: filters.doctorId || undefined,
    status: filters.status || undefined,
    includeWalkIns: filters.includeWalkIns ?? true,
    search: filters.search?.trim() || undefined,
    page,
    limit,
  };
}

/** Params for one CLINIC day (bounds from `clinicDayBounds`). */
export function appointmentListParams(
  ymd: string,
  filters: AppointmentFilters,
  page: number,
  limit: number = APPOINTMENTS_PAGE_SIZE,
) {
  return appointmentRangeParams(clinicDayBounds(ymd), filters, page, limit);
}

/** `GET /appointments` for any UTC range — one page. */
export async function fetchAppointmentsRange(
  range: UtcRange,
  filters: AppointmentFilters,
  page: number,
  limit: number = APPOINTMENTS_PAGE_SIZE,
): Promise<AppointmentPage> {
  const res = await staffApi.get<ApiResponse<AppointmentPage>>('/appointments', {
    params: appointmentRangeParams(range, filters, page, limit),
  });
  return res.data.data;
}

/** `GET /appointments` — one page of the clinic day. */
export function fetchAppointments(
  ymd: string,
  filters: AppointmentFilters,
  page: number,
  limit: number = APPOINTMENTS_PAGE_SIZE,
): Promise<AppointmentPage> {
  return fetchAppointmentsRange(clinicDayBounds(ymd), filters, page, limit);
}

/**
 * Every booking of the day (no walk-ins), paging until `page * limit >= total`.
 * The bookings query sorts by start time only and pages with skip/take, so rows
 * sharing a start time can repeat across pages — de-duplicated by `id`.
 */
export async function fetchAllDayBookings(ymd: string): Promise<AppointmentListItem[]> {
  const byId = new Map<string, AppointmentListItem>();
  for (let page = 1; page <= MAX_DAY_PAGES; page += 1) {
    const res = await fetchAppointments(ymd, { includeWalkIns: false }, page);
    for (const row of res.data) if (!byId.has(row.id)) byId.set(row.id, row);
    if (res.page * res.limit >= res.total || res.data.length === 0) return [...byId.values()];
    if (page === MAX_DAY_PAGES) log.warn('appointments: day list truncated at the page cap');
  }
  return [...byId.values()];
}

/** The next `limit` bookings from `from` (UTC ISO, normally now) to the end of the clinic day. */
export async function fetchUpcomingAppointments(
  from: string,
  ymd: string,
  limit: number,
): Promise<AppointmentListItem[]> {
  const res = await fetchAppointmentsRange(
    { start: from, end: clinicDayBounds(ymd).end },
    { includeWalkIns: false },
    1,
    limit,
  );
  return res.data;
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
