import { CirclePause, CircleCheck, Play } from 'lucide-react-native';
import { View } from 'react-native';

import { OfflineAwareButton, Spinner } from '@/core/components';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import type { EntryView, SessionView } from '../../types/queue.types';

export interface StartSessionCardProps {
  busy: boolean;
  onStart: () => void;
}

/** `waiting_for_doctor`: the doctor has not opened today's queue yet. */
export function StartSessionCard({ busy, onStart }: StartSessionCardProps) {
  return (
    <View className="border-border bg-card mx-4 items-center gap-3 rounded-xl border p-6">
      <View className="bg-muted size-14 items-center justify-center rounded-full">
        <Icon as={Play} className="text-muted-foreground size-6" />
      </View>
      <Text variant="large" className="text-center">
        Your session hasn&apos;t started
      </Text>
      <Text variant="muted" className="text-center">
        Start it to begin calling patients.
      </Text>
      <OfflineAwareButton
        label="Start session"
        className="min-h-11 self-stretch"
        disabled={busy}
        onPress={onStart}
      />
      {busy ? <Spinner /> : null}
    </View>
  );
}

export interface PausedBannerProps {
  reason: string | null;
  busy: boolean;
  onResume: () => void;
}

/** `paused`: banner with the reason; Call next is disabled elsewhere. */
export function PausedBanner({ reason, busy, onResume }: PausedBannerProps) {
  return (
    <View
      accessibilityRole="alert"
      className="bg-warning/15 border-warning mx-4 gap-2 rounded-xl border p-4">
      <View className="flex-row items-center gap-2">
        <Icon as={CirclePause} className="text-foreground size-5" />
        <Text className="flex-1 font-medium">{reason ? `Paused — ${reason}` : 'Paused'}</Text>
      </View>
      <OfflineAwareButton label="Resume" className="min-h-11" disabled={busy} onPress={onResume} />
    </View>
  );
}

/** Counts by outcome for the day (docs/06 "closed: summary counts"). */
export function closedSummary(entries: EntryView[]) {
  const count = (...s: EntryView['status'][]) => entries.filter((e) => s.includes(e.status)).length;
  return {
    seen: count('completed'),
    cancelled: count('cancelled', 'aborted'),
    transferred: count('transferred'),
    notSeen: count('waiting', 'called', 'in_consultation', 'on_hold', 'skipped'),
  };
}

export interface ClosedSummaryCardProps {
  session: SessionView;
  entries: EntryView[];
}

/** `closed`: nothing to do, just today's outcome. */
export function ClosedSummaryCard({ entries }: ClosedSummaryCardProps) {
  const s = closedSummary(entries);
  const rows: [string, number][] = [
    ['Seen', s.seen],
    ['Cancelled', s.cancelled],
    ['Transferred', s.transferred],
    ['Not seen', s.notSeen],
  ];
  return (
    <View className="border-border bg-card mx-4 gap-3 rounded-xl border p-6">
      <View className="flex-row items-center gap-2">
        <Icon as={CircleCheck} className="text-success size-5" />
        <Text variant="large">Session closed for today</Text>
      </View>
      {rows.map(([label, n]) => (
        <View
          key={label}
          accessible
          accessibilityLabel={`${label}: ${n}`}
          className="flex-row items-center justify-between">
          <Text variant="muted">{label}</Text>
          <Text className="font-semibold tabular-nums">{n}</Text>
        </View>
      ))}
    </View>
  );
}
