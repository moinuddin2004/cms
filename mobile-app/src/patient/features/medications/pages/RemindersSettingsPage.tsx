import { useRouter } from 'expo-router';
import { BatteryCharging, BellRing, ChevronRight } from 'lucide-react-native';
import { Linking, Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '@/core/components';
import { useT } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Icon } from '@/core/ui/icon';
import { Switch } from '@/core/ui/switch';
import { Text } from '@/core/ui/text';

import { useNotificationPermission } from '../hooks/useNotificationPermission';
import { useReminderSettings } from '../lib/reminder-settings';

/** Reminder settings (docs/06 P-05): permission status, private reminders, battery guide. */
export function RemindersSettingsPage() {
  const { t } = useT();
  const router = useRouter();
  const permission = useNotificationPermission();
  const priv = useReminderSettings((s) => s.privateReminders);
  const setPriv = useReminderSettings((s) => s.setPrivateReminders);
  const ready = useReminderSettings((s) => s.hydrated);
  const on = permission.state === 'granted';

  return (
    <Screen scroll header={<ScreenHeader title={t('reminders.settings.title')} backLabel={t('common.back')} />}>
      <View className="gap-4 px-4 pb-8 pt-2">
        <View className="bg-card border-border gap-3 rounded-xl border p-4">
          <View className="flex-row items-center gap-3">
            <Icon as={BellRing} className="text-primary size-6" />
            <View className="flex-1">
              <Text variant="large">
                {t(on ? 'reminders.settings.permissionOn' : 'reminders.settings.permissionOff')}
              </Text>
              <Text variant="muted">
                {t(on ? 'reminders.settings.permissionOnBody' : 'reminders.settings.permissionOffBody')}
              </Text>
            </View>
          </View>
          {permission.state === 'undetermined' ? (
            <Button className="min-h-11" onPress={() => void permission.request()}>
              <Text>{t('reminders.settings.turnOn')}</Text>
            </Button>
          ) : null}
          {permission.state === 'denied' ? (
            <Button variant="outline" className="min-h-11" onPress={() => void Linking.openSettings()}>
              <Text>{t('reminders.settings.openSettings')}</Text>
            </Button>
          ) : null}
        </View>

        <View className="bg-card border-border flex-row items-center gap-3 rounded-xl border p-4">
          <View className="flex-1">
            <Text variant="large">{t('reminders.settings.privateTitle')}</Text>
            <Text variant="muted">{t('reminders.settings.privateBody')}</Text>
          </View>
          <Switch
            disabled={!ready}
            checked={priv}
            onCheckedChange={setPriv}
            accessibilityLabel={t('reminders.settings.privateTitle')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reminders.settings.batteryTitle')}
          onPress={() => router.push('/reminders/battery')}
          className="bg-card border-border min-h-11 flex-row items-center gap-3 rounded-xl border p-4 active:opacity-70">
          <Icon as={BatteryCharging} className="text-primary size-6" />
          <View className="flex-1">
            <Text variant="large">{t('reminders.settings.batteryTitle')}</Text>
            <Text variant="muted">{t('reminders.settings.batteryBody')}</Text>
          </View>
          <Icon as={ChevronRight} className="text-muted-foreground size-5" />
        </Pressable>
      </View>
    </Screen>
  );
}
