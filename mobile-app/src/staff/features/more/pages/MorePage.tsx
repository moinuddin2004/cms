import { useRouter } from 'expo-router';
import { ChevronRight, Info, LayoutGrid, MapPin, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { currentVersion } from '@/core/app-version';
import { EmptyState, ListRow, Screen, ScreenHeader, Spinner } from '@/core/components';
import { switchSpace } from '@/core/space/switch-space';
import { Icon } from '@/core/ui/icon';
import { useAccess } from '@/staff/features/access';
import { NotificationBell } from '@/staff/features/notifications';
import { visibleTabs } from '@/staff/navigation';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { ProfileCard } from '../components/ProfileCard';
import { SignOutRow } from '../components/SignOutRow';
import { SwitchLocationSheet } from '../components/SwitchLocationSheet';
import { useSwitchLocation } from '../hooks/useSwitchLocation';
import { locationOptions } from '../lib/location-options';

const CHEVRON = <Icon as={ChevronRight} className="text-muted-foreground size-5" />;

/** S-08: profile, switch location, switch space, version, sign out (docs/06). */
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
    <Screen scroll header={<ScreenHeader title="More" back={false} actions={<NotificationBell />} />}>
      <ProfileCard />

      {noFeatures ? (
        <EmptyState
          title="No mobile features for your role"
          description="Ask the clinic owner if you need access."
          className="py-6"
        />
      ) : null}

      <View className="bg-card border-border overflow-hidden rounded-xl border">
        {options.length > 1 ? (
          <ListRow
            leading={<Icon as={MapPin} className="text-muted-foreground size-5" />}
            title="Switch location"
            subtitle={currentLocation}
            disabled={switchLocation.isPending}
            trailing={switchLocation.isPending ? <Spinner tone="foreground" /> : CHEVRON}
            onPress={() => setSheetOpen(true)}
          />
        ) : null}
        <ListRow
          leading={<Icon as={UserRound} className="text-muted-foreground size-5" />}
          title="Switch to patient space"
          trailing={CHEVRON}
          onPress={() => switchSpace('patient')}
        />
        {__DEV__ ? (
          <ListRow
            leading={<Icon as={LayoutGrid} className="text-muted-foreground size-5" />}
            title="Component gallery"
            subtitle="Development builds only"
            trailing={CHEVRON}
            onPress={() => router.push('/__gallery')}
          />
        ) : null}
        <ListRow
          leading={<Icon as={Info} className="text-muted-foreground size-5" />}
          title="App version"
          meta={currentVersion}
        />
      </View>

      <View className="bg-card border-border overflow-hidden rounded-xl border">
        <SignOutRow />
      </View>

      <SwitchLocationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        options={options}
        onPick={(o) =>
          switchLocation.mutate({ organizationId: o.organizationId, locationId: o.locationId })
        }
      />
    </Screen>
  );
}
