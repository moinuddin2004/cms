import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import {
  EmptyState,
  ErrorState,
  FilterChips,
  IconButton,
  LoadingSkeleton,
  NoResultsState,
  Screen,
  ScreenHeader,
  SearchBar,
  Spinner,
} from '@/core/components';
import { Text } from '@/core/ui/text';
import { useAccess } from '@/staff/features/access';
import { NotificationBell } from '@/staff/features/notifications';

import { PatientRow } from '../components/PatientRow';
import { QuickRegisterSheet } from '../components/QuickRegisterSheet';
import { RecentPatients } from '../components/RecentPatients';
import { MIN_SEARCH_LENGTH, usePatientsInfinite } from '../hooks/usePatientsInfinite';
import { useRecentPatientsStore } from '../store/useRecentPatientsStore';
import type { PatientDetail, PatientListItem } from '../types/patients.types';

const CHIPS = [
  { value: 'active', label: 'Active' },
  { value: 'minors', label: 'Minors' },
];
const DEFAULT_CHIPS = ['active'];

const keyOf = (p: PatientListItem) => p.id;

/** S-04 Patients tab: search, filter chips, infinite list, recently opened, quick register. */
export function PatientsPage() {
  const router = useRouter();
  const { can } = useAccess();
  const canCreate = can('patients.create');
  const pushRecent = useRecentPatientsStore((s) => s.push);

  const [search, setSearch] = useState('');
  const [chips, setChips] = useState<string[]>(DEFAULT_CHIPS);
  const [registerOpen, setRegisterOpen] = useState(false);

  const searching = search.trim().length >= MIN_SEARCH_LENGTH;
  const filters = useMemo(
    () => ({
      search,
      sortBy: 'createdAt' as const,
      sortOrder: 'DESC' as const,
      ...(chips.includes('active') ? { isActive: true } : {}),
      ...(chips.includes('minors') ? { isMinor: true as const } : {}),
    }),
    [search, chips],
  );
  const query = usePatientsInfinite(filters);
  const patients = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);

  // Anything other than "Active only, no search" is a filtered view.
  const filtered = searching || chips.length !== 1 || chips[0] !== 'active';

  const open = useCallback(
    (patientId: string) => {
      pushRecent(patientId);
      router.push({ pathname: '/patients/[patientId]', params: { patientId } });
    },
    [pushRecent, router],
  );

  const clearFilters = () => {
    setSearch('');
    setChips(DEFAULT_CHIPS);
  };

  const onCreated = (patient: PatientDetail) => {
    setRegisterOpen(false);
    toast.success('Patient registered');
    open(patient.id);
  };

  const onSearchPhone = (phone: string) => {
    setRegisterOpen(false);
    setChips(DEFAULT_CHIPS);
    setSearch(phone);
  };

  const onEndReached = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };

  let body;
  if (query.isPending) {
    body = <LoadingSkeleton />;
  } else if (query.isError && patients.length === 0) {
    body = <ErrorState onRetry={() => void query.refetch()} className="flex-1 justify-center" />;
  } else {
    body = (
      <FlashList
        data={patients}
        keyExtractor={keyOf}
        renderItem={({ item }) => <PatientRow patient={item} onPress={open} />}
        keyboardShouldPersistTaps="handled"
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={searching ? null : <RecentPatients onOpen={open} />}
        ListEmptyComponent={
          filtered ? (
            <NoResultsState onClear={clearFilters} />
          ) : (
            <EmptyState
              icon={Users}
              title="No patients yet"
              description={canCreate ? 'Register the first patient to get started.' : undefined}
              actionLabel={canCreate ? 'Register patient' : undefined}
              onAction={canCreate ? () => setRegisterOpen(true) : undefined}
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View accessibilityRole="progressbar" className="flex-row items-center justify-center gap-2 py-4">
              <Spinner />
              <Text variant="muted">Loading more…</Text>
            </View>
          ) : null
        }
      />
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Patients"
          back={false}
          actions={
            <>
              {canCreate ? (
                <IconButton
                  icon={Plus}
                  accessibilityLabel="Register patient"
                  onPress={() => setRegisterOpen(true)}
                />
              ) : null}
              <NotificationBell />
            </>
          }
        />
      }>
      <View className="gap-3 pb-2">
        <View className="px-4">
          <SearchBar value={search} onChange={setSearch} placeholder="Name, phone or MR no." />
        </View>
        <FilterChips options={CHIPS} value={chips} onChange={setChips} multiple />
      </View>
      {query.isError && patients.length > 0 ? (
        <ErrorState
          title="Could not refresh"
          message="Showing the patients already loaded."
          onRetry={() => void query.refetch()}
          className="py-4"
        />
      ) : null}
      <View className="flex-1">{body}</View>
      {canCreate ? (
        <QuickRegisterSheet
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          onCreated={onCreated}
          onSearchPhone={onSearchPhone}
        />
      ) : null}
    </Screen>
  );
}
