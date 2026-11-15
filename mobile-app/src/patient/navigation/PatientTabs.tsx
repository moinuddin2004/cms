import { Tabs } from 'expo-router/js-tabs';
import { FileText, House } from 'lucide-react-native';
import { useCSSVariable } from 'uniwind';

import { useT } from '@/core/i18n';

function useTokenColor(name: string): string | undefined {
  const value = useCSSVariable(name);
  return typeof value === 'string' ? value : undefined;
}

/**
 * The patient bottom tabs (docs/02 §4). Minimal for now: Home + Records. The
 * Family / More tabs join with M2-10 and later cards.
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
          tabBarIcon: ({ color }) => <House size={26} color={color} />,
          tabBarAccessibilityLabel: t('records.homeTab'),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: t('records.tab'),
          tabBarIcon: ({ color }) => <FileText size={26} color={color} />,
          tabBarAccessibilityLabel: t('records.tab'),
        }}
      />
    </Tabs>
  );
}
