import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { todayYmd } from '@/staff/lib/datetime';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import {
  APPOINTMENTS_PAGE_SIZE,
  fetchAllDayBookings,
  fetchAppointment,
  fetchAppointmentStats,
  fetchAppointments,
  fetchDoctors,
  fetchUpcomingAppointments,
} from '../api/appointments.api';
import { appointmentKeys } from '../api/appointments.keys';
import { selectArrivals } from '../lib/arrivals';
import type { AppointmentFilters } from '../types/appointments.types';

/** Org + location of the active session — part of every key (docs/04 §7). */
function useScope() {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  return { orgId, locationId, ready: !!orgId && !!locationId };
}

/**
 * One clinic day of appointments (walk-ins included unless
 * `filters.includeWalkIns === false`), paged. Next page exists while
 * `page * limit < total` — the backend sends no `totalPages`.
 */
export function useDayAppointments(ymd: string, filters: AppointmentFilters = {}) {
  const { orgId, locationId, ready } = useScope();
  return useInfiniteQuery({
    queryKey: appointmentKeys.list(orgId, locationId, ymd, filters),
    queryFn: ({ pageParam }) => fetchAppointments(ymd, filters, pageParam, APPOINTMENTS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    enabled: ready,
    staleTime: 30_000,
  });
}

/** `GET /appointments/:id`. */
export function useAppointment(id: string | undefined) {
  const { orgId, locationId, ready } = useScope();
  return useQuery({
    queryKey: appointmentKeys.detail(orgId, locationId, id ?? ''),
    queryFn: () => fetchAppointment(id ?? ''),
    enabled: ready && !!id,
    staleTime: 30_000,
  });
}

/** Counts for one clinic day. */
export function useAppointmentStats(ymd: string) {
  const { orgId, locationId, ready } = useScope();
  return useQuery({
    queryKey: appointmentKeys.stats(orgId, locationId, ymd),
    queryFn: () => fetchAppointmentStats(ymd),
    enabled: ready,
    staleTime: 30_000,
  });
}

/** Doctors at the active location (filter chips). */
export function useDoctors() {
  const { orgId, locationId, ready } = useScope();
  return useQuery({
    queryKey: appointmentKeys.doctors(orgId, locationId),
    queryFn: fetchDoctors,
    enabled: ready,
    staleTime: 10 * 60_000,
  });
}

/**
 * S-03: the day's `scheduled | confirmed` bookings with no queue entry,
 * earliest first. Loads every page of the day's bookings, then filters.
 */
export function useArrivals(ymd: string, allowed = true) {
  const { orgId, locationId, ready } = useScope();
  return useQuery({
    queryKey: appointmentKeys.arrivals(orgId, locationId, ymd),
    queryFn: () => fetchAllDayBookings(ymd),
    select: selectArrivals,
    enabled: ready && allowed,
    staleTime: 15_000,
  });
}

/**
 * The next `limit` bookings from NOW to the end of the clinic day (no
 * walk-ins) — the Today tile (07 §2.7). `startDate` is read when the request
 * runs, so a refetch always starts from the current time.
 */
export function useUpcomingAppointments(limit = 5) {
  const { orgId, locationId, ready } = useScope();
  const ymd = todayYmd();
  return useQuery({
    queryKey: appointmentKeys.upcoming(orgId, locationId, ymd, limit),
    queryFn: () => fetchUpcomingAppointments(new Date().toISOString(), ymd, limit),
    enabled: ready,
    staleTime: 30_000,
  });
}
