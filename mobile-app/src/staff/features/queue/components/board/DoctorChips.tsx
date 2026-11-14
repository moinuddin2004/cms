import { Plus } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { IconButton } from '@/core/components';
import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { OpenLane } from './board-model';

export interface DoctorChipsProps {
  lanes: OpenLane[];
  activeDoctorId: string | null;
  onSelect: (doctorId: string) => void;
  /** Undefined hides `[+]` (every doctor already has a lane). */
  onOpenLane?: () => void;
  openLaneDisabled?: boolean;
}

/** Horizontal doctor chips with waiting counts; `[+]` opens a lane for a doctor without a session. */
export function DoctorChips({
  lanes,
  activeDoctorId,
  onSelect,
  onOpenLane,
  openLaneDisabled,
}: DoctorChipsProps) {
  return (
    <View className="flex-row items-center">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
        contentContainerClassName="gap-2 px-4">
        {lanes.map((lane) => {
          const selected = lane.doctor.id === activeDoctorId;
          return (
            <Pressable
              key={lane.doctor.id}
              accessibilityRole="button"
              accessibilityLabel={`${lane.doctor.fullName}, ${lane.waitingCount} waiting`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(lane.doctor.id)}
              className={cn(
                'min-h-11 flex-row items-center gap-2 rounded-full border px-4',
                selected ? 'border-primary bg-primary' : 'border-border bg-card active:bg-accent',
              )}>
              <Text
                className={cn('text-sm font-medium', selected && 'text-primary-foreground')}
                numberOfLines={1}>
                {lane.doctor.fullName}
              </Text>
              <Text className={cn('text-sm font-bold', selected && 'text-primary-foreground')}>
                {lane.waitingCount}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {onOpenLane ? (
        <IconButton
          icon={Plus}
          variant="outline"
          accessibilityLabel="Open a lane for another doctor"
          disabled={openLaneDisabled}
          onPress={onOpenLane}
          className="me-2"
        />
      ) : null}
    </View>
  );
}
