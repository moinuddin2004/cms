import { Linking, View } from 'react-native';

import { Screen, ScreenHeader } from '@/core/components';
import { useT, type MessageKey } from '@/core/i18n';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';

const GENERIC: MessageKey[] = [
  'reminders.battery.generic1',
  'reminders.battery.generic2',
  'reminders.battery.generic3',
];
const BRANDS: MessageKey[] = [
  'reminders.battery.xiaomi',
  'reminders.battery.huawei',
  'reminders.battery.oppo',
  'reminders.battery.samsung',
  'reminders.battery.oneplus',
  'reminders.battery.other',
];

/**
 * OEM battery-optimisation guide: many Android makers kill background alarms, so a reminder can be
 * silently dropped (docs/06 P-05, M3-03). Static, no data — one tap opens this app's system settings.
 */
export function BatteryGuidePage() {
  const { t } = useT();
  return (
    <Screen scroll header={<ScreenHeader title={t('reminders.battery.title')} backLabel={t('common.back')} />}>
      <View className="gap-5 px-4 pb-8 pt-2">
        <Text variant="muted">{t('reminders.battery.intro')}</Text>

        <View className="gap-2">
          <Text variant="large" accessibilityRole="header">
            {t('reminders.battery.stepsTitle')}
          </Text>
          {GENERIC.map((key, i) => (
            <Text key={key}>{`${i + 1}. ${t(key)}`}</Text>
          ))}
        </View>

        <View className="gap-2">
          <Text variant="large" accessibilityRole="header">
            {t('reminders.battery.brandsTitle')}
          </Text>
          {BRANDS.map((key) => (
            <View key={key} className="bg-card border-border rounded-xl border p-3">
              <Text>{t(key)}</Text>
            </View>
          ))}
        </View>

        <Button size="lg" onPress={() => void Linking.openSettings()}>
          <Text>{t('reminders.battery.openSettings')}</Text>
        </Button>
      </View>
    </Screen>
  );
}
