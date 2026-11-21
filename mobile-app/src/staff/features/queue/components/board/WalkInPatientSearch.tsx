import { useState } from 'react';
import { View } from 'react-native';

import { ErrorState, ListRow, LoadingSkeleton, NoResultsState, SearchBar } from '@/core/components';
import { Text } from '@/core/ui/text';
import { usePatientsInfinite } from '@/staff/features/patients/hooks/usePatientsInfinite';
import { maskPhone } from '@/staff/features/patients/lib/mask-phone';

export interface PickedPatient {
  id: string;
  label: string;
}

export interface WalkInPatientSearchProps {
  onPick: (patient: PickedPatient) => void;
}

/** Debounced patient search (`GET /patients?search=`) for the walk-in; first page only, refine to narrow. */
export function WalkInPatientSearch({ onPick }: WalkInPatientSearchProps) {
  const [search, setSearch] = useState('');
  const query = usePatientsInfinite({ search }, { enabled: search.trim().length >= 2 });
  const searching = search.trim().length >= 2;
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View className="gap-2">
      <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone or number" />
      {!searching ? (
        <Text variant="muted">Type at least 2 characters.</Text>
      ) : query.isPending ? (
        <LoadingSkeleton rows={3} className="px-0" />
      ) : query.isError ? (
        <ErrorState className="py-6" onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <NoResultsState />
      ) : (
        <View className="border-border overflow-hidden rounded-md border">
          {rows.map((p) => (
            <ListRow
              key={p.id}
              title={p.fullName}
              subtitle={[p.patientNumber, maskPhone(p.phone)].filter(Boolean).join(' · ')}
              onPress={() => onPick({ id: p.id, label: p.fullName })}
            />
          ))}
          {query.hasNextPage ? (
            <Text variant="muted" className="px-4 py-2">
              More matches — type more to narrow the search.
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
