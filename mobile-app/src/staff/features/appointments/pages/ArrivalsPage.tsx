import { FlashList } from '@shopify/flash-list';
import { Lock, UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
} from '@/core/components';
import { useStableCallback } from '@/core/hooks/use-stable-callback';
import { useCanMutate } from '@/core/http';
import { Text } from '@/core/ui/text';
import { useAccess } from '@/staff/features/access';
import { UrgentReasonSheet } from '@/staff/features/queue';
import { useClinicToday } from '@/staff/lib/clinic-today';
import { formatInClinic } from '@/staff/lib/datetime';

import { ArrivalRow } from '../components/ArrivalRow';
import { LateWalkInDialog } from '../components/LateWalkInDialog';
import { useArrivals } from '../hooks/useAppointments';
import { useCheckInFlow } from '../hooks/useCheckInFlow';
import type { AppointmentListItem } from '../types/appointments.types';

/**
 * S-03 Arrivals (docs/06): today's `scheduled | confirmed` bookings with no
 * queue entry, earliest first. [Check in] sends the booking to its doctor's
 * queue (token toast); the triangle variant asks for an urgent reason first.
 * Past the late limit the server answers `LATE_LIMIT_EXCEEDED` and the dialog
 * offers "Add as walk-in". Opened from the board's Arrivals row (`queue.checkin`).
 */
export function ArrivalsPage() {
  const { can } = useAccess();
  const allowed = can('queue.checkin') && can('appointments.view');
  const today = useClinicToday();
  const canMutate = useCanMutate();
  const query = useArrivals(today, allowed);
  const flow = useCheckInFlow(() => undefined);
  const [urgentFor, setUrgentFor] = useState<AppointmentListItem | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const startCheckIn = (row: AppointmentListItem, urgentReason?: string) => {
    setCheckingId(row.id);
    flow.start(row.id, urgentReason);
  };

  const checkInRow = useStableCallback((row: AppointmentListItem) => startCheckIn(row));

  const rows = query.data ?? [];
  const savedAt = query.dataUpdatedAt ? formatInClinic(query.dataUpdatedAt, 'HH:mm') : undefined;

  let body;
  if (!allowed) {
    body = (
      <EmptyState
        icon={Lock}
        title="You don't have access"
        description="Ask your clinic owner if you need to check patients in."
      />
    );
  } else if (query.isPending) {
    body = <LoadingSkeleton />;
  } else if (query.isError && rows.length === 0) {
    body = <ErrorState onRetry={() => void query.refetch()} />;
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon={UserCheck}
        title="No one left to check in"
        description="Today's appointments that have not arrived yet appear here."
      />
    );
  } else {
    body = (
      <FlashList<AppointmentListItem>
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => (
          <ArrivalRow
            row={item}
            checkingIn={flow.checkingIn && checkingId === item.id}
            locked={flow.checkingIn || !canMutate}
            onCheckIn={checkInRow}
            onCheckInUrgent={setUrgentFor}
          />
        )}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          query.isError ? (
            <Text variant="muted" className="px-4 py-2" accessibilityRole="alert">
              Could not refresh. Pull down to try again.
            </Text>
          ) : null
        }
      />
    );
  }

  return (
    <Screen
      edges={['top', 'bottom']}
      savedAt={savedAt}
      header={
        <ScreenHeader
          title="Arrivals"
          subtitle={allowed && rows.length > 0 ? `${rows.length} waiting to arrive` : undefined}
          back
        />
      }>
      <View className="flex-1">{body}</View>
      <UrgentReasonSheet
        open={urgentFor !== null}
        onClose={() => setUrgentFor(null)}
        title={urgentFor ? `Urgent: ${urgentFor.patient.fullName}` : 'Urgent check-in'}
        submitLabel="Check in as urgent"
        onSubmit={async (reason) => {
          const row = urgentFor;
          if (!row) return;
          setUrgentFor(null);
          startCheckIn(row, reason);
        }}
      />
      <LateWalkInDialog open={flow.lateOpen} onClose={flow.dismissLate} onConfirm={flow.convert} />
    </Screen>
  );
}
