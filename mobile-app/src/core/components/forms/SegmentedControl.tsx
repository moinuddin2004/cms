import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

export interface Segment {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  /** 2–4 segments. */
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
  /** Selection haptic on change (docs/05 §7). Default on. */
  haptic?: boolean;
}

/** 2–4 segment switch. */
export function SegmentedControl({ segments, value, onChange, haptic = true }: SegmentedControlProps) {
  return (
    <View accessibilityRole="tablist" className="bg-muted flex-row gap-1 rounded-lg p-1">
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              if (haptic) void Haptics.selectionAsync().catch(() => undefined);
              onChange(segment.value);
            }}
            className={cn(
              'min-h-11 flex-1 items-center justify-center rounded-md px-3',
              selected && 'bg-background shadow-sm',
            )}>
            <Text
              className={cn('text-sm font-medium', !selected && 'text-muted-foreground')}
              numberOfLines={1}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
