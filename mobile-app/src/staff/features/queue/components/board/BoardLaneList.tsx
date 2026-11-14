import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { I18nManager } from 'react-native';

import { ListRow, SectionHeader } from '@/core/components';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';

import type { EntryView } from '../../types/queue.types';
import { BoardEntryRow } from './BoardEntryRow';
import type { OpenLane } from './board-model';
import type { LaneItem } from './lane-items';

export interface BoardLaneListProps {
  lane: OpenLane;
  items: LaneItem[];
  nowIso: string;
  pendingEntryId: string | null;
  focusEntryId: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenArrivals: () => void;
  onOpenActions: (entry: EntryView) => void;
  onBackFromTest: (entry: EntryView) => void;
}

/** One lane as a FlashList: arrivals link, banner, now serving, waiting, on hold / skipped. */
export function BoardLaneList({
  lane,
  items,
  nowIso,
  pendingEntryId,
  focusEntryId,
  refreshing,
  onRefresh,
  onOpenArrivals,
  onOpenActions,
  onBackFromTest,
}: BoardLaneListProps) {
  const listRef = useRef<FlashListRef<LaneItem>>(null);

  // A fresh walk-in: bring its row into view.
  useEffect(() => {
    if (!focusEntryId) return;
    const index = items.findIndex((i) => i.type === 'entry' && i.entry.id === focusEntryId);
    if (index >= 0) void listRef.current?.scrollToIndex({ index, animated: true });
  }, [focusEntryId, items]);

  return (
    <FlashList
      ref={listRef}
      data={items}
      keyExtractor={(item) => item.key}
      getItemType={(item) => item.type}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerClassName="pb-24"
      renderItem={({ item }) => {
        switch (item.type) {
          case 'arrivals':
            return (
              <ListRow
                title="Arrivals"
                subtitle="Today's appointments not yet checked in"
                onPress={onOpenArrivals}
                trailing={
                  <Icon
                    as={I18nManager.isRTL ? ChevronLeft : ChevronRight}
                    className="text-muted-foreground"
                  />
                }
              />
            );
          case 'banner':
            return (
              <Text variant="muted" className="px-4 py-2">
                {item.text}
              </Text>
            );
          case 'header':
            return <SectionHeader title={item.title} count={item.count} />;
          case 'empty':
            return (
              <Text variant="muted" className="px-4 py-2">
                {item.text}
              </Text>
            );
          case 'entry':
            return (
              <BoardEntryRow
                entry={item.entry}
                session={lane.snapshot.session}
                nowIso={nowIso}
                pending={pendingEntryId === item.entry.id}
                highlighted={focusEntryId === item.entry.id}
                onOpenActions={onOpenActions}
                onBackFromTest={onBackFromTest}
              />
            );
        }
      }}
    />
  );
}
