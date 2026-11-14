import { useQuery } from '@tanstack/react-query';

import { useAccess } from '@/staff/features/access';
import {
  appointmentKeys,
  fetchAppointmentStats,
  fetchUpcomingAppointments,
} from '@/staff/features/appointments';
import { fetchBoard } from '@/staff/features/queue';
import { useClinicToday } from '@/staff/lib/clinic-today';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { fetchDailySummary, fetchInvoiceStats } from '../api/today.api';
import { todayKeys } from '../api/today.keys';
import { fromDailySummary, fromInvoiceStats } from '../lib/collections';
import { toDoctorsNow } from '../lib/doctors-now';
import { isGateOpen, toGated } from './gated-query';

/** Org + location of the active session, plus the clinic's current day. */
function useTodayScope() {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const ymd = useClinicToday();
  return { orgId, locationId, ymd, ready: !!orgId && !!locationId };
}

/**
 * Appointment/queue counts for today. Needs `appointments.view`. Shares the
 * `appointmentKeys.stats` cache entry with `useAppointmentStats`, which has no
 * gate, so this hook owns the `enabled` check and never fires when denied.
 */
export function useTodayStats() {
  const { status, can } = useAccess();
  const { orgId, locationId, ymd, ready } = useTodayScope();
  const allowed = isGateOpen(status, can('appointments.view'));
  const query = useQuery({
    queryKey: appointmentKeys.stats(orgId, locationId, ymd),
    queryFn: () => fetchAppointmentStats(ymd),
    enabled: allowed && ready,
    staleTime: 30_000,
  });
  return toGated(status, allowed, query);
}

/**
 * Collected today / outstanding. Needs `billing.invoice.view`. With
 * `reports.financial.view` AND feature `billing.financial_summary` it reads the
 * daily summary; otherwise it falls back to invoice stats (issue date = today).
 * `data.source` says which one answered. Decimal money, not minor units.
 */
export function useTodayCollections() {
  const { status, can, hasFeature } = useAccess();
  const { orgId, locationId, ymd, ready } = useTodayScope();
  const allowed = isGateOpen(status, can('billing.invoice.view'));
  const useDaily = can('reports.financial.view') && hasFeature('billing.financial_summary');
  const source = useDaily ? 'daily' : 'invoices';
  const query = useQuery({
    queryKey: todayKeys.collections(orgId, locationId, ymd, source),
    queryFn: () =>
      useDaily
        ? fetchDailySummary(ymd).then(fromDailySummary)
        : fetchInvoiceStats(ymd, ymd).then(fromInvoiceStats),
    enabled: allowed && ready,
    staleTime: 30_000,
  });
  return toGated(status, allowed, query);
}

/**
 * One row per doctor lane. Needs `queue.board.view`. No socket room here (the
 * room helper is private to the queue feature): it polls every 30 s and the
 * screen's pull to refresh refetches. Own key (the board key holds the raw
 * `BoardResponse` for `useBoard`).
 */
export function useDoctorsNow() {
  const { status, can } = useAccess();
  const { orgId, locationId, ymd, ready } = useTodayScope();
  const allowed = isGateOpen(status, can('queue.board.view'));
  const query = useQuery({
    queryKey: todayKeys.doctorsNow(orgId, locationId, ymd),
    queryFn: () => fetchBoard(ymd).then(toDoctorsNow),
    enabled: allowed && ready,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  return toGated(status, allowed, query);
}

/**
 * The next `limit` bookings from now to the end of the clinic day (no
 * walk-ins). Needs `appointments.view`. Same key and fetcher as
 * `useUpcomingAppointments`, which is ungated.
 */
export function useNextAppointments(limit = 5) {
  const { status, can } = useAccess();
  const { orgId, locationId, ymd, ready } = useTodayScope();
  const allowed = isGateOpen(status, can('appointments.view'));
  const query = useQuery({
    queryKey: appointmentKeys.upcoming(orgId, locationId, ymd, limit),
    queryFn: () => fetchUpcomingAppointments(new Date().toISOString(), ymd, limit),
    enabled: allowed && ready,
    staleTime: 30_000,
  });
  return toGated(status, allowed, query);
}
