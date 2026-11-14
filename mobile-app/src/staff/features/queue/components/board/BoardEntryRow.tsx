import { Ellipsis } from 'lucide-react-native';
import { View } from 'react-native';

import {
  IconButton,
  OfflineAwareButton,
  QUEUE_STATUS_TONES,
  StatusBadge,
  TokenBadge,
  URGENT_BADGE,
} from '@/core/components';
import { useCanMutate } from '@/core/http';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';
import { formatTime } from '@/staff/lib/datetime';

import { useEntryActions } from '../../hooks/useEntryActions';
import type { EntryView, SessionView } from '../../types/queue.types';
import { waitedMinutes } from './board-model';

export interface BoardEntryRowProps {
  entry: EntryView;
  session: SessionView;
  /** The server's `now` for the wait times. */
  nowIso: string;
  /** This row has an action in flight: everything on it is disabled. */
  pending: boolean;
  highlighted?: boolean;
  onOpenActions: (entry: EntryView) => void;
  onBackFromTest: (entry: EntryView) => void;
}

/** "walk-in 15m" or "10:30 appt" — the line under the patient's name. */
export function entrySubtitle(entry: EntryView, nowIso: string): string {
  const parts: string[] = [];
  if (entry.queueType === 'appointment' && entry.scheduledStart) {
    parts.push(`${formatTime(entry.scheduledStart)} appt`);
  } else if (entry.queueType === 'walk_in') {
    parts.push(`walk-in ${waitedMinutes(entry.checkedInAt, nowIso)}m`);
  }
  if (entry.reasonForVisit) parts.push(entry.reasonForVisit);
  return parts.join(' · ');
}

/** One patient on the board: token, name, wait, urgent/status badges and the ⋯ menu. */
export function BoardEntryRow({
  entry,
  session,
  nowIso,
  pending,
  highlighted = false,
  onOpenActions,
  onBackFromTest,
}: BoardEntryRowProps) {
  const actions = useEntryActions(entry, session, 'board');
  const canMutate = useCanMutate();
  const name = entry.patient?.fullName ?? 'Unknown patient';
  const status = QUEUE_STATUS_TONES[entry.status];
  const urgent = entry.priorityClass === 'authorized_urgent';
  const showStatus = entry.status !== 'waiting';
  const subtitle = entrySubtitle(entry, nowIso);

  return (
    <View
      accessible={false}
      className={cn(
        'min-h-14 flex-row items-center gap-3 px-4 py-2',
        highlighted && 'bg-primary/10',
        pending && 'opacity-50',
      )}>
      <TokenBadge token={entry.token} size="sm" />
      <View className="flex-1 gap-1">
        <Text className="text-base" numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text variant="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {urgent || showStatus ? (
          <View className="flex-row flex-wrap gap-1">
            {urgent ? <StatusBadge {...URGENT_BADGE} /> : null}
            {showStatus ? <StatusBadge {...status} /> : null}
          </View>
        ) : null}
      </View>
      {actions.includes('return-from-test') ? (
        <OfflineAwareButton
          label="Back from test"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onPress={() => onBackFromTest(entry)}
        />
      ) : null}
      <IconButton
        icon={Ellipsis}
        accessibilityLabel={`Actions for ${entry.token} ${name}`}
        disabled={pending}
        // Offline: the sheet still opens for the ticket and patient file.
        onPress={() => onOpenActions(entry)}
        accessibilityHint={canMutate ? undefined : 'Changes are unavailable offline'}
      />
    </View>
  );
}
