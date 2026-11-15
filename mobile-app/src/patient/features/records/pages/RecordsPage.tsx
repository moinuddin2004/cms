import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader, SearchBar, SegmentedControl } from '@/core/components';
import { useT } from '@/core/i18n';

import { AppointmentCard, BillCard, PrescriptionCard, VisitCard } from '../components/RecordCards';
import { RecordsList } from '../components/RecordsList';
import {
  useRecordAppointments,
  useRecordBilling,
  useRecordPrescriptions,
  useRecordVisits,
} from '../hooks/useRecords';
import { matchesQuery } from '../lib/records-format';
import type { RecordSegment } from '../types/records.types';

/**
 * P-03 Records tab: four segments (appointments, visits, prescriptions, bills),
 * each with loading / empty / error-retry / no-results states. Bills hide when
 * no linked clinic shows billing. Profile filter joins with the profiles
 * endpoints (M2-10); every hook already takes a `profileId`.
 */
export function RecordsPage() {
  const { t } = useT();
  const router = useRouter();
  const [segment, setSegment] = useState<RecordSegment>('appointments');
  const [search, setSearch] = useState('');

  const appointments = useRecordAppointments();
  const visits = useRecordVisits();
  const prescriptions = useRecordPrescriptions();
  const billing = useRecordBilling();

  // Hide Bills once we KNOW no clinic shows billing (never while loading or failed).
  const showBills = !(billing.isSuccess && (billing.data?.length ?? 0) === 0);
  const active: RecordSegment = segment === 'bills' && !showBills ? 'appointments' : segment;

  const segments = useMemo(() => {
    const all: { value: RecordSegment; label: string }[] = [
      { value: 'appointments', label: t('records.segments.appointments') },
      { value: 'visits', label: t('records.segments.visits') },
      { value: 'prescriptions', label: t('records.segments.prescriptions') },
      { value: 'bills', label: t('records.segments.bills') },
    ];
    return showBills ? all : all.filter((s) => s.value !== 'bills');
  }, [t, showBills]);

  const visitItems = useMemo(
    () => visits.data?.pages.flatMap((p) => p.data) ?? [],
    [visits.data],
  );
  const prescriptionItems = useMemo(
    () => prescriptions.data?.pages.flatMap((p) => p.data) ?? [],
    [prescriptions.data],
  );

  const filtered = search.trim().length > 0;
  const clear = () => setSearch('');

  const appointmentItems = useMemo(
    () =>
      (appointments.data ?? []).filter((a) =>
        matchesQuery(search, [a.clinic.name, a.location.name, a.doctorName]),
      ),
    [appointments.data, search],
  );
  const visitRows = useMemo(
    () =>
      visitItems.filter((v) =>
        matchesQuery(search, [v.clinic.name, v.location.name, v.doctorName, v.diagnosis]),
      ),
    [visitItems, search],
  );
  const prescriptionRows = useMemo(
    () =>
      prescriptionItems.filter((p) =>
        matchesQuery(search, [p.clinic.name, p.location.name, p.doctorName, p.number]),
      ),
    [prescriptionItems, search],
  );
  const billRows = useMemo(
    () => billing.rows.filter((r) => matchesQuery(search, [r.clinic.name, r.invoice.number])),
    [billing.rows, search],
  );

  return (
    <Screen header={<ScreenHeader title={t('records.title')} back={false} backLabel={t('common.back')} />}>
      <View className="gap-3 px-4 pb-2">
        <SegmentedControl
          segments={segments}
          value={active}
          onChange={(v) => setSegment(v as RecordSegment)}
        />
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('records.search')}
          clearLabel={t('records.clearSearch')}
        />
      </View>

      {active === 'appointments' ? (
        <RecordsList
          items={appointmentItems}
          isLoading={appointments.isLoading}
          isError={appointments.isError}
          onRetry={() => void appointments.refetch()}
          onRefresh={() => appointments.refetch()}
          emptyTitle={t('records.empty.appointments')}
          emptyBody={t('records.empty.appointmentsBody')}
          filtered={filtered}
          onClearFilters={clear}
          keyOf={(a) => a.id}
          renderItem={(a) => (
            <AppointmentCard
              item={a}
              onPress={() => router.push({ pathname: '/appointments/[id]', params: { id: a.id } })}
            />
          )}
        />
      ) : null}

      {active === 'visits' ? (
        <RecordsList
          items={visitRows}
          isLoading={visits.isLoading}
          isError={visits.isError}
          onRetry={() => void visits.refetch()}
          onRefresh={() => visits.refetch()}
          emptyTitle={t('records.empty.visits')}
          emptyBody={t('records.empty.visitsBody')}
          filtered={filtered}
          onClearFilters={clear}
          keyOf={(v) => v.id}
          renderItem={(v) => <VisitCard item={v} />}
          onEndReached={() => {
            if (visits.hasNextPage && !visits.isFetchingNextPage) void visits.fetchNextPage();
          }}
          loadingMore={visits.isFetchingNextPage}
        />
      ) : null}

      {active === 'prescriptions' ? (
        <RecordsList
          items={prescriptionRows}
          isLoading={prescriptions.isLoading}
          isError={prescriptions.isError}
          onRetry={() => void prescriptions.refetch()}
          onRefresh={() => prescriptions.refetch()}
          emptyTitle={t('records.empty.prescriptions')}
          emptyBody={t('records.empty.prescriptionsBody')}
          filtered={filtered}
          onClearFilters={clear}
          keyOf={(p) => p.id}
          renderItem={(p) => (
            <PrescriptionCard
              item={p}
              onPress={() => router.push({ pathname: '/prescriptions/[id]', params: { id: p.id } })}
            />
          )}
          onEndReached={() => {
            if (prescriptions.hasNextPage && !prescriptions.isFetchingNextPage)
              void prescriptions.fetchNextPage();
          }}
          loadingMore={prescriptions.isFetchingNextPage}
        />
      ) : null}

      {active === 'bills' ? (
        <RecordsList
          items={billRows}
          isLoading={billing.isLoading}
          isError={billing.isError}
          onRetry={() => void billing.refetch()}
          onRefresh={() => billing.refetch()}
          emptyTitle={t('records.empty.bills')}
          emptyBody={t('records.empty.billsBody')}
          filtered={filtered}
          onClearFilters={clear}
          keyOf={(r) => r.invoice.id}
          renderItem={(r) => <BillCard row={r} />}
        />
      ) : null}
    </Screen>
  );
}
