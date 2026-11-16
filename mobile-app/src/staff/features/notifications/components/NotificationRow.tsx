import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/core/ui/text';
import { cn } from '@/core/utils';

import type { NotificationRowModel } from '../lib/notification-row';

export interface NotificationRowProps {
  id: string;
  model: NotificationRowModel;
  /** Stable across renders (one handler for every row). */
  onPress: (id: string) => void;
}

/** One inbox row: unread = bold title + dot; other-clinic rows carry the clinic name. */
export const NotificationRow = memo(function NotificationRow({ id, model, onPress }: NotificationRowProps) {
  const { title, body, time, unread, otherClinic } = model;
  const label = [unread ? 'Unread' : null, otherClinic, title, body, time]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPress(id)}
      className="active:bg-accent min-h-14 flex-row items-start gap-1 px-4 py-3">
      <View className="size-6 items-center justify-center pt-1.5">
        <View className={cn('size-2.5 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} />
      </View>
      <View className="flex-1 gap-0.5">
        {otherClinic ? (
          <Text variant="muted" className="text-xs font-medium" numberOfLines={1}>
            {otherClinic}
          </Text>
        ) : null}
        <Text variant="large" className={cn(unread ? 'font-bold' : 'font-normal')} numberOfLines={2}>
          {title}
        </Text>
        {body ? (
          <Text variant="muted" numberOfLines={3}>
            {body}
          </Text>
        ) : null}
        <Text variant="muted" className="text-xs">
          {time}
        </Text>
      </View>
    </Pressable>
  );
});
