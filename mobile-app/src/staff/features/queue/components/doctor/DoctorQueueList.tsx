import { FlashList } from '@shopify/flash-list';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState, SectionHeader, StatusBadge, QUEUE_STATUS_TONES } from '@/core/components';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import type { EntryActionId } from '../../lib/entry-actions';
import type { EntryView, SessionSnapshot } from '../../types/queue.types';
import { suggestionReasonLabel } from './doctor-labels';
import { CurrentPatientCard } from './CurrentPatientCard';
import { PausedBanner } from './SessionPanels';
import { useTickingNow } from '../../hooks/useTickingNow';
import { WaitingRow } from './WaitingRow';

export interface DoctorQueueListProps {
  snapshot: SessionSnapshot;
  current: EntryView | null;
  busyEntryIds: ReadonlySet<string>;
  sessionBusy: boolean;
  /** Pinned above the cards: connection pill + session menu + summary line. */
  topBar: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  onEntryAction: (action: EntryActionId, entry: EntryView) => void;
  onRowMenu: (entry: EntryView) => void;
  onResume: () => void;
}

/** Waiting entries in the server's `waitingOrder`; ids the snapshot no longer holds are dropped. */
export function waitingEntries(snapshot: SessionSnapshot): EntryView[] {
  const byId = new Map(snapshot.entries.map((e) => [e.id, e]));
  return snapshot.waitingOrder.flatMap((id) => {
    const entry = byId.get(id);
    return entry && entry.status === 'waiting' ? [entry] : [];
  });
}

/** S-02a body for an open / paused session: current card, suggestion, waiting list, on hold / skipped. */
export function DoctorQueueList(props: DoctorQueueListProps) {
  const { snapshot, current, busyEntryIds, sessionBusy, topBar, onRowMenu } = props;
  const { session } = snapshot;
  const [holdOpen, setHoldOpen] = useState(false);
  const now = useTickingNow(snapshot.now);
  const locked = sessionBusy || busyEntryIds.size > 0;
  const waiting = waitingEntries(snapshot);
  const parked = snapshot.entries.filter((e) => e.status === 'on_hold' || e.status === 'skipped');
  const suggested = snapshot.suggestion
    ? snapshot.entries.find((e) => e.id === snapshot.suggestion?.entryId)
    : undefined;

  const header = (
    <View className="gap-3 pb-2">
      {topBar}
      {session.status === 'paused' ? (
        <PausedBanner reason={session.pauseReason} busy={sessionBusy} onResume={props.onResume} />
      ) : null}
      {current ? (
        <CurrentPatientCard
          entry={current}
          session={session}
          busy={busyEntryIds.has(current.id)}
          onAction={props.onEntryAction}
        />
      ) : null}
      {suggested && snapshot.suggestion && session.status === 'open' ? (
        <View
          accessible
          className="mx-4 flex-row flex-wrap items-center gap-2"
          accessibilityLabel={`Next suggested: ${suggested.token}, ${suggestionReasonLabel(snapshot.suggestion.reason)}`}>
          <Text variant="muted">Next suggested: {suggested.token}</Text>
          <StatusBadge tone="info" label={suggestionReasonLabel(snapshot.suggestion.reason)} />
        </View>
      ) : null}
      <SectionHeader title="Waiting" count={waiting.length} />
    </View>
  );

  const footer = (
    <View className="pb-6">
      {parked.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`On hold or skipped, ${parked.length}`}
            accessibilityState={{ expanded: holdOpen }}
            onPress={() => setHoldOpen((v) => !v)}
            className="min-h-11 flex-row items-center justify-between px-4">
            <Text variant="large">On hold / Skipped ({parked.length})</Text>
            <Icon
              as={holdOpen ? ChevronUp : ChevronDown}
              className="text-muted-foreground size-5"
            />
          </Pressable>
          {holdOpen
            ? parked.map((entry) => (
                <View key={entry.id} className="flex-row items-center">
                  <View className="flex-1">
                    <WaitingRow
                      entry={entry}
                      session={session}
                      now={now}
                      busy={busyEntryIds.has(entry.id)}
                      locked={locked}
                      onMenu={onRowMenu}
                    />
                  </View>
                  <StatusBadge {...QUEUE_STATUS_TONES[entry.status]} className="me-4" />
                </View>
              ))
            : null}
        </>
      ) : null}
    </View>
  );

  return (
    <FlashList
      data={waiting}
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => (
        <WaitingRow
          entry={item}
          session={session}
          now={now}
          busy={busyEntryIds.has(item.id)}
          locked={locked}
          onMenu={onRowMenu}
        />
      )}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <EmptyState
          title="No one is waiting"
          description="New arrivals show up here."
          className="py-8"
        />
      }
      refreshing={props.refreshing}
      onRefresh={props.onRefresh}
    />
  );
}
