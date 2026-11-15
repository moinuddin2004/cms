import { View } from 'react-native';

import {
  ErrorState,
  LoadingSkeleton,
  ReadOnlySheet,
  QUEUE_STATUS_TONES,
  StatusBadge,
  TokenBadge,
} from '@/core/components';
import { Text } from '@/core/ui/text';
import { formatTime } from '@/staff/lib/datetime';

import { useTicket } from '../../hooks/useTicket';

export interface TicketSheetProps {
  /** null = closed. */
  entryId: string | null;
  onClose: () => void;
}

function TicketBody({ entryId }: { entryId: string }) {
  const ticket = useTicket(entryId);
  if (ticket.isPending) return <LoadingSkeleton rows={3} />;
  if (ticket.isError) return <ErrorState className="py-6" onRetry={() => void ticket.refetch()} />;
  const t = ticket.data;
  return (
    <View className="items-center gap-3">
      <TokenBadge token={t.token} size="lg" />
      {t.patientName ? <Text variant="large">{t.patientName}</Text> : null}
      {t.doctorName ? <Text variant="muted">{`Doctor: ${t.doctorName}`}</Text> : null}
      <StatusBadge {...QUEUE_STATUS_TONES[t.status]} />
      {t.peopleAhead !== null ? (
        <Text className="text-base">
          {t.peopleAhead === 1 ? '1 person ahead' : `${t.peopleAhead} people ahead`}
        </Text>
      ) : null}
      <Text variant="muted">{`Checked in ${formatTime(t.checkedInAt)}`}</Text>
    </View>
  );
}

/** The patient's queue ticket: token, status and people ahead (`GET entries/:id/ticket`). */
export function TicketSheet({ entryId, onClose }: TicketSheetProps) {
  return (
    <ReadOnlySheet
      open={entryId !== null}
      onClose={onClose}
      title="Ticket"
      closeLabel="Close">
      {entryId ? <TicketBody entryId={entryId} /> : null}
    </ReadOnlySheet>
  );
}
