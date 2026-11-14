import { MoreHorizontal } from 'lucide-react-native';

import { IconButton, ListRow, StatusBadge, TokenBadge, URGENT_BADGE } from '@/core/components';
import { useCanMutate } from '@/core/http';
import { formatTime } from '@/staff/lib/datetime';

import { useEntryActions } from '../../hooks/useEntryActions';
import type { EntryView, SessionView } from '../../types/queue.types';
import { waitingLabel } from './doctor-labels';

export interface WaitingRowProps {
  entry: EntryView;
  session: SessionView;
  /** The snapshot's `now`, so waiting times do not depend on the phone clock. */
  now: string;
  busy: boolean;
  /** Opens the row menu ("Call this patient"). Offered only when the entry allows `select`. */
  onMenu: (entry: EntryView) => void;
}

/** One waiting patient (also used, without the menu, for on-hold / skipped rows). */
export function WaitingRow({ entry, session, now, busy, onMenu }: WaitingRowProps) {
  const actions = useEntryActions(entry, session, 'doctor');
  const canMutate = useCanMutate();
  const name = entry.patient?.fullName ?? 'Walk-in patient';
  const when =
    entry.queueType === 'appointment' && entry.scheduledStart
      ? `${formatTime(entry.scheduledStart)} appt`
      : `walk-in ${waitingLabel(entry.checkedInAt, now)}`;
  const urgent = entry.priorityClass === 'authorized_urgent';

  return (
    <ListRow
      leading={<TokenBadge token={entry.token} size="sm" />}
      title={name}
      subtitle={urgent ? undefined : (entry.reasonForVisit ?? undefined)}
      meta={when}
      disabled={busy}
      accessibilityLabel={`${name}, token ${entry.token}, ${urgent ? 'urgent, ' : ''}${
        entry.status === 'waiting' ? 'waiting' : entry.status.replace('_', ' ')
      }, ${when}`}
      trailing={
        <>
          {urgent ? <StatusBadge {...URGENT_BADGE} /> : null}
          {actions.includes('select') ? (
            <IconButton
              icon={MoreHorizontal}
              accessibilityLabel={`Actions for ${entry.token}`}
              disabled={busy || !canMutate}
              loading={busy}
              onPress={() => onMenu(entry)}
            />
          ) : null}
        </>
      }
    />
  );
}
