import { View } from 'react-native';

import { Skeleton } from '@/core/ui/skeleton';
import { SectionHeader } from '@/core/components';

import { usePatient } from '../hooks/usePatient';
import { useRecentPatientsStore } from '../store/useRecentPatientsStore';
import { PatientRow } from './PatientRow';

function RecentRow({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const { data, isPending } = usePatient(id);
  if (isPending) {
    return (
      <View className="min-h-14 justify-center px-4 py-3">
        <Skeleton className="h-4 w-2/3" />
      </View>
    );
  }
  // A recent patient that can no longer be read simply drops out of the section.
  return data ? <PatientRow patient={data} onPress={onOpen} /> : null;
}

/** "Recently opened" — ids from the in-memory store, resolved to rows (shown while the search box is empty). */
export function RecentPatients({ onOpen }: { onOpen: (id: string) => void }) {
  const ids = useRecentPatientsStore((s) => s.ids);
  if (ids.length === 0) return null;
  return (
    <View className="pb-2">
      <SectionHeader title="Recently opened" />
      {ids.map((id) => (
        <RecentRow key={id} id={id} onOpen={onOpen} />
      ))}
      <SectionHeader title="All patients" />
    </View>
  );
}
