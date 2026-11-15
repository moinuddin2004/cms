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

/** Look one appointment up from the list (there is no single-appointment endpoint). */
export function useRecordAppointment(id: string) {
  const query = useRecordAppointments(null);
  const appointment = useMemo(() => query.data?.find((a) => a.id === id) ?? null, [query.data, id]);
  return { ...query, appointment };
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
