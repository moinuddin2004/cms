import { Users } from 'lucide-react-native';
import { View } from 'react-native';

import {
  APPOINTMENT_STATUS_TONES,
  EmptyState,
  ListRow,
  SectionHeader,
  StatTile,
  StatusBadge,
} from '@/core/components';
import { Skeleton } from '@/core/ui/skeleton';
import { Text } from '@/core/ui/text';
import type { AppointmentListItem, AppointmentStats } from '@/staff/features/appointments';
import { formatCurrency } from '@/staff/lib/currency';
import { formatTime } from '@/staff/lib/datetime';

import { avgWaitLabel, doctorNowSummary } from '../lib/today-format';
import type { DoctorNow, TodayCollections } from '../types/today.types';

export const SKELETONS = {
  tiles: (
    <View className="flex-row gap-3 px-4">
      <Skeleton className="h-24 flex-1 rounded-xl" />
      <Skeleton className="h-24 flex-1 rounded-xl" />
      <Skeleton className="h-24 flex-1 rounded-xl" />
    </View>
  ),
  rows: (
    <View className="gap-3 px-4">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </View>
  ),
};

export function StatsTiles({ stats }: { stats: AppointmentStats }) {
  return (
    <View className="flex-row gap-3 px-4">
      <StatTile label="Appointments" value={stats.total} />
      <StatTile
        label="Waiting now"
        value={stats.waiting}
        tone={stats.waiting > 0 ? 'warning' : undefined}
      />
      <StatTile label="Avg wait" value={avgWaitLabel(stats.avgWaitMinutes)} />
    </View>
  );
}

export function CollectionsTiles({ data }: { data: TodayCollections }) {
  const overdue = data.overdueCount > 0 ? `${data.overdueCount} overdue` : undefined;
  const tone = data.overdueCount > 0 ? 'destructive' : undefined;
  // Amounts are decimal (rupees), not minor units: formatted as they are.
  return (
    <View className="flex-row gap-3 px-4">
      <StatTile label="Collected today" value={formatCurrency(data.collected)} tone="success" />
      {data.unpaidCount !== null ? (
        <StatTile label="Unpaid invoices" value={data.unpaidCount} hint={overdue} tone={tone} />
      ) : (
        <StatTile
          label="Outstanding"
          value={formatCurrency(data.outstanding)}
          hint={overdue}
          tone={tone}
        />
      )}
    </View>
  );
}

export function DoctorsNowList({
  doctors,
  onOpen,
}: {
  doctors: DoctorNow[];
  onOpen: (doctorId: string) => void;
}) {
  return (
    <View>
      <SectionHeader title="Doctors now" />
      {doctors.length === 0 ? (
        <EmptyState icon={Users} title="No doctors on the board" className="py-6" />
      ) : (
        doctors.map((d) => (
          <ListRow
            key={d.doctorId}
            title={d.doctorName}
            meta={doctorNowSummary(d)}
            onPress={() => onOpen(d.doctorId)}
          />
        ))
      )}
    </View>
  );
}

export function NextAppointmentsList({
  rows,
  onSeeAll,
}: {
  rows: AppointmentListItem[];
  onSeeAll: () => void;
}) {
  return (
    <View>
      <SectionHeader title="Next appointments" action={{ label: 'All', onPress: onSeeAll }} />
      {rows.length === 0 ? (
        <Text variant="muted" className="px-4 py-3">
          No more appointments today
        </Text>
      ) : (
        rows.map((r) => {
          const status = APPOINTMENT_STATUS_TONES[r.status];
          const time = formatTime(r.startTime);
          return (
            <ListRow
              key={r.id}
              title={r.patient.fullName}
              subtitle={r.doctor.fullName || undefined}
              meta={time}
              trailing={<StatusBadge {...status} />}
              accessibilityLabel={[time, r.patient.fullName, r.doctor.fullName, status.label]
                .filter(Boolean)
                .join(', ')}
            />
          );
        })
      )}
    </View>
  );
}
