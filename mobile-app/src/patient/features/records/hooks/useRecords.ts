import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  fetchAppointments,
  fetchBilling,
  fetchPrescription,
  fetchPrescriptions,
  fetchVisits,
} from '../api/records.api';
import { recordKeys } from '../api/records.keys';
import { toBillRows } from '../lib/records-format';
import { useAccountId } from './useAccountId';

/** Appointments of every linked clinic (or one profile). */
export function useRecordAppointments(profileId: string | null = null) {
  const accountId = useAccountId();
  return useQuery({
    queryKey: recordKeys.appointments(accountId, profileId),
    queryFn: () => fetchAppointments(profileId),
    enabled: !!accountId,
  });
}

/** Appointments starting from now: small, and the only appointments kept in the offline cache. */
export function useRecordUpcomingAppointments(profileId: string | null = null) {
  const accountId = useAccountId();
  return useQuery({
    queryKey: recordKeys.appointmentsUpcoming(accountId, profileId),
    queryFn: () => fetchAppointments(profileId, new Date().toISOString()),
    enabled: !!accountId,
  });
}

/**
 * What the Appointments segment shows: the full list (past included, online
 * only), falling back to the cached upcoming ones while it is not available.
 */
export function useRecordAppointmentList(profileId: string | null = null) {
  const all = useRecordAppointments(profileId);
  const upcoming = useRecordUpcomingAppointments(profileId);
  const data = all.data ?? upcoming.data;
  return {
    data,
    isLoading: all.isPending && upcoming.isPending,
    isError: all.isError && !upcoming.data,
    refetch: () => Promise.all([all.refetch(), upcoming.refetch()]),
  };
}

/** Look one appointment up from the lists (there is no single-appointment endpoint). */
export function useRecordAppointment(id: string) {
  const list = useRecordAppointmentList(null);
  const appointment = useMemo(() => list.data?.find((a) => a.id === id) ?? null, [list.data, id]);
  return { ...list, appointment };
}

export function useRecordVisits(profileId: string | null = null) {
  const accountId = useAccountId();
  return useInfiniteQuery({
    queryKey: recordKeys.visits(accountId, profileId),
    queryFn: ({ pageParam }) => fetchVisits(profileId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!accountId,
  });
}

export function useRecordPrescriptions(profileId: string | null = null) {
  const accountId = useAccountId();
  return useInfiniteQuery({
    queryKey: recordKeys.prescriptions(accountId, profileId),
    queryFn: ({ pageParam }) => fetchPrescriptions(profileId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!accountId,
  });
}

export function useRecordPrescription(id: string) {
  const accountId = useAccountId();
  return useQuery({
    queryKey: recordKeys.prescription(accountId, id),
    queryFn: () => fetchPrescription(id),
    enabled: !!accountId && !!id,
  });
}

/** Per-clinic billing summaries plus the flat invoice rows. */
export function useRecordBilling(profileId: string | null = null) {
  const accountId = useAccountId();
  const query = useQuery({
    queryKey: recordKeys.billing(accountId, profileId),
    queryFn: () => fetchBilling(profileId),
    enabled: !!accountId,
  });
  const rows = useMemo(() => toBillRows(query.data ?? []), [query.data]);
  return { ...query, rows };
}
