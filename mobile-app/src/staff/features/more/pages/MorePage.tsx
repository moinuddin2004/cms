import { useRouter } from 'expo-router';
import { ChevronRight, Info, LayoutGrid, MapPin, UserRound } from 'lucide-react-native';
import { useState } from 'react';

import { currentVersion } from '@/core/app-version';
import {
  EmptyState,
  IconTile,
  ListRow,
  Screen,
  ScreenHeader,
  SettingsGroup,
  Spinner,
  ThemeModePicker,
} from '@/core/components';
import { switchSpace } from '@/core/space/switch-space';
import { Icon } from '@/core/ui/icon';
import { AccessErrorState, useAccess } from '@/staff/features/access';
import { NotificationBell, NotificationSoundRow } from '@/staff/features/notifications';
import { visibleTabs } from '@/staff/navigation';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { ProfileCard } from '../components/ProfileCard';
import { SignOutRow } from '../components/SignOutRow';
import { SwitchLocationSheet } from '../components/SwitchLocationSheet';
import { useSwitchLocation } from '../hooks/useSwitchLocation';
import { locationOptions } from '../lib/location-options';

const CHEVRON = <Icon as={ChevronRight} className="text-muted-foreground size-5" />;

/** S-08: profile, switch location, appearance, switch space, version, sign out (docs/06). */
export function MorePage() {
  const router = useRouter();
  const access = useAccess();
  const organizations = useStaffAuthStore((s) => s.accessibleOrganizations);
  const org = useStaffAuthStore(activeOrganization);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const switchLocation = useSwitchLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const options = locationOptions(organizations, org?.id ?? null, locationId);
  const currentLocation = org?.locations.find((l) => l.id === locationId)?.name;
  const noFeatures = access.status === 'ready' && visibleTabs(access.can).length === 1;

  return (
    <Screen
      scroll
      header={<ScreenHeader title="More" back={false} actions={<NotificationBell />} />}>
      <ProfileCard />

      <AccessErrorState className="py-6" />

      {noFeatures ? (
        <EmptyState
          title="No mobile features for your role"
          description="Ask the clinic owner if you need access."
          className="py-6"
        />
      ) : null}

      <SettingsGroup title="Clinic">
        {options.length > 1 ? (
          <ListRow
            leading={<IconTile icon={MapPin} tone="primary" />}
            title="Switch location"
            subtitle={currentLocation}
            disabled={switchLocation.isPending}
            trailing={switchLocation.isPending ? <Spinner tone="foreground" /> : CHEVRON}
            onPress={() => setSheetOpen(true)}
          />
        ) : null}
        <NotificationSoundRow />
      </SettingsGroup>

      <SettingsGroup
        title="Appearance"
        footer="Your choice is saved on this phone and beats the clinic's default."
        padded>
        <ThemeModePicker />
      </SettingsGroup>

      <SettingsGroup title="App">
        <ListRow
          leading={<IconTile icon={UserRound} tone="success" />}
          title="Switch to patient space"
          subtitle="Your family's visits, records and reminders"
          trailing={CHEVRON}
          onPress={() => switchSpace('patient')}
        />
        {__DEV__ ? (
          <ListRow
            leading={<IconTile icon={LayoutGrid} tone="warning" />}
            title="Component gallery"
            subtitle="Development builds only"
            trailing={CHEVRON}
            onPress={() => router.push('/__gallery')}
          />
        ) : null}
        <ListRow
          leading={<IconTile icon={Info} tone="neutral" />}
          title="App version"
          meta={currentVersion}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SignOutRow />
      </SettingsGroup>

      <SwitchLocationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        options={options}
        onPick={(o) =>
          switchLocation.mutate({
            organizationId: o.organizationId,
            locationId: o.locationId,
          })
        }
      />
    </Screen>
  );
}
