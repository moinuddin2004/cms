import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { CalendarDays, Ellipsis, ListOrdered, Sun, Users, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { useCSSVariable } from 'uniwind';

import { useAccess } from '@/staff/features/access';

import { initialTab, STAFF_TABS, visibleTabs, type StaffTabName } from './tab-access';

const ICONS: Record<StaffTabName, LucideIcon> = {
  today: Sun,
  queue: ListOrdered,
  patients: Users,
  schedule: CalendarDays,
  more: Ellipsis,
};

const HREFS = {
  today: '/today',
  queue: '/queue',
  patients: '/patients',
  schedule: '/schedule',
  more: '/more',
} as const;

/** Theme token → colour string for navigator chrome, which cannot take classes. */
function useTokenColor(name: string): string | undefined {
  const value = useCSSVariable(name);
  return typeof value === 'string' ? value : undefined;
}

/**
 * The staff bottom tabs (docs/02 §4). Each tab declares the permissions it
 * needs (`tab-access.ts`); a tab the user may not open is hidden with
 * `href: null`. Access loads after mount, so once it is ready for the first
 * time the app moves to the first allowed tab (Queue → Today → …).
 */
export function StaffTabs() {
  const router = useRouter();
  const access = useAccess();
  const shown = new Set(visibleTabs(access.can));

  const active = useTokenColor('--color-primary');
  const inactive = useTokenColor('--color-muted-foreground');
  const background = useTokenColor('--color-background');
  const border = useTokenColor('--color-border');

  const placed = useRef(false);
  useEffect(() => {
    if (access.status !== 'ready' || placed.current) return;
    placed.current = true;
    const first = initialTab(access.can);
    if (first !== 'more') router.replace(HREFS[first]);
  }, [access.status, access.can, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: { backgroundColor: background, borderTopColor: border },
      }}>
      {STAFF_TABS.map((tab) => {
        const TabIcon = ICONS[tab.name];
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              href: shown.has(tab.name) ? undefined : null,
              tabBarIcon: ({ color }) => <TabIcon size={24} color={color} />,
              tabBarAccessibilityLabel: tab.title,
            }}
          />
        );
      })}
    </Tabs>
  );
}
