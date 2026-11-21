import { Tabs } from 'expo-router/js-tabs';
import { CalendarCheck, FileText, House, Users } from 'lucide-react-native';
import { useCSSVariable } from 'uniwind';

import { useT } from '@/core/i18n';

function useTokenColor(name: string): string | undefined {
  const value = useCSSVariable(name);
  return typeof value === 'string' ? value : undefined;
}

/**
 * The patient bottom tabs (docs/02 §4): Home, Today, Records, Family. Every
 * route file under `(tabs)/` must be declared here, or Expo Router shows it
 * with its raw file name and a fallback icon. Home carries the settings (UI-02).
 */
export function PatientTabs() {
  const { t } = useT();
  const active = useTokenColor('--color-primary');
  const inactive = useTokenColor('--color-muted-foreground');
  const background = useTokenColor('--color-background');
  const border = useTokenColor('--color-border');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: { backgroundColor: background, borderTopColor: border },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('records.homeTab'),
          tabBarIcon: ({ color }) => <House size={24} color={color} />,
          tabBarAccessibilityLabel: t('records.homeTab'),
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: t('today.title'),
          tabBarIcon: ({ color }) => <CalendarCheck size={24} color={color} />,
          tabBarAccessibilityLabel: t('today.title'),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: t('records.tab'),
          tabBarIcon: ({ color }) => <FileText size={24} color={color} />,
          tabBarAccessibilityLabel: t('records.tab'),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: t('family.title'),
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
          tabBarAccessibilityLabel: t('family.title'),
        }}
      />
    </Tabs>
  );
}
