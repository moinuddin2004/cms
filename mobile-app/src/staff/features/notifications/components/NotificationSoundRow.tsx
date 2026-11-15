import { Volume2 } from 'lucide-react-native';

import { ListRow } from '@/core/components';
import { Icon } from '@/core/ui/icon';
import { Switch } from '@/core/ui/switch';

import { useNotificationPrefs, useSetNotificationSound } from '../hooks/useNotifications';

/** More-tab row: in-app notification sound (S-08). Optimistic; rolls back on error (hook). */
export function NotificationSoundRow() {
  const prefs = useNotificationPrefs();
  const setSound = useSetNotificationSound();
  const sound = prefs.data?.sound ?? false;
  const disabled = !prefs.data;
  const toggle = (next: boolean) => setSound.mutate(next);

  return (
    <ListRow
      leading={<Icon as={Volume2} className="text-muted-foreground size-5" />}
      title="Notification sound"
      subtitle={prefs.isError ? 'Could not load this setting' : undefined}
      disabled={disabled}
      onPress={() => toggle(!sound)}
      accessibilityLabel={`Notification sound, ${sound ? 'on' : 'off'}`}
      trailing={
        <Switch
          checked={sound}
          disabled={disabled}
          onCheckedChange={toggle}
          accessibilityLabel="Notification sound"
        />
      }
    />
  );
}
