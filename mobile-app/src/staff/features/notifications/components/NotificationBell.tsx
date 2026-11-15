import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '@/core/components';
import { Text } from '@/core/ui/text';

import { useUnreadCount } from '../hooks/useNotifications';

export interface NotificationBellButtonProps {
  count?: number;
  onPress?: () => void;
}

/** Presentational bell: badge hidden at 0, "99+" cap. Icon-only, so it carries its own label (docs/04 §14). */
export function NotificationBellButton({ count = 0, onPress }: NotificationBellButtonProps) {
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

/**
 * Header bell wired to the unread count (realtime `notification.new` invalidates it) and the
 * inbox screen. A failed count shows no badge rather than a wrong one.
 */
export function NotificationBell() {
  const router = useRouter();
  const { data } = useUnreadCount();
  return (
    <NotificationBellButton count={data ?? 0} onPress={() => router.push('/notifications')} />
  );
}
