import { Bell } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '@/core/components';
import { Text } from '@/core/ui/text';

export interface NotificationBellProps {
  /** Unread notifications. M1-13 wires the real count; 0 until then. */
  count?: number;
  onPress?: () => void;
}

/** Header bell with an unread badge. Icon-only, so it carries its own label (docs/04 §14). */
export function NotificationBell({ count = 0, onPress }: NotificationBellProps) {
  return (
    <View>
      <IconButton
        icon={Bell}
        accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        disabled={!onPress}
        onPress={onPress}
      />
      {count > 0 ? (
        <View
          pointerEvents="none"
          className="bg-destructive absolute -end-0.5 -top-0.5 min-w-5 items-center rounded-full px-1">
          <Text className="text-destructive-foreground text-xs font-semibold">
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
