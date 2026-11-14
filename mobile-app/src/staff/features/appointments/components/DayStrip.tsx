import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';
import { formatYmd } from '@/staff/lib/datetime';

export interface DayStripProps {
  /** "YYYY-MM-DD" days on the clinic clock (`dayStrip(today)`). */
  days: readonly string[];
  selected: string;
  today: string;
  onSelect: (ymd: string) => void;
}

/** Yesterday … +6 days. Selecting a day never touches the filters (they live in the page). */
export function DayStrip({ days, selected, today, onSelect }: DayStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4">
      {days.map((ymd) => {
        const active = ymd === selected;
        const label = `${formatYmd(ymd, 'EEEE, MMM d')}${ymd === today ? ', today' : ''}`;
        return (
          <Pressable
            key={ymd}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(ymd)}
            className={cn(
              'min-h-14 min-w-14 items-center justify-center rounded-lg border px-2 py-1',
              active ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent',
            )}>
            <Text
              className={cn(
                'text-xs font-medium',
                active ? 'text-primary-foreground' : 'text-muted-foreground',
              )}>
              {ymd === today ? 'Today' : formatYmd(ymd, 'EEE')}
            </Text>
            <Text className={cn('text-lg font-semibold', active && 'text-primary-foreground')}>
              {formatYmd(ymd, 'd')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
