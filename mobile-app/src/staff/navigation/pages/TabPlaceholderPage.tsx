import { Hourglass } from 'lucide-react-native';

import { EmptyState, Screen, ScreenHeader } from '@/core/components';
import { NotificationBell } from '@/staff/features/notifications';

import { STAFF_TABS, type StaffTabName } from '../tab-access';

export interface TabPlaceholderPageProps {
  tab: Exclude<StaffTabName, 'more'>;
}

/** Stand-in for a tab whose real page arrives in a later card (Today, Queue, Patients, Schedule). */
export function TabPlaceholderPage({ tab }: TabPlaceholderPageProps) {
  const title = STAFF_TABS.find((t) => t.name === tab)?.title ?? '';
  return (
    <Screen header={<ScreenHeader title={title} back={false} actions={<NotificationBell />} />}>
      <EmptyState
        icon={Hourglass}
        title="Coming soon"
        description="This screen is being built."
        className="flex-1 justify-center"
      />
    </Screen>
  );
}
