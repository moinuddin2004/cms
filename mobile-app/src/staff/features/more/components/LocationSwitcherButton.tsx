import { MapPin } from 'lucide-react-native';
import { useState } from 'react';

import { IconButton } from '@/core/components';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { useSwitchLocation } from '../hooks/useSwitchLocation';
import { locationOptions } from '../lib/location-options';

import { SwitchLocationSheet } from './SwitchLocationSheet';

/** Header button that opens the location sheet. Renders nothing with fewer than two places. */
export function LocationSwitcherButton() {
  const organizations = useStaffAuthStore((s) => s.accessibleOrganizations);
  const org = useStaffAuthStore(activeOrganization);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const switchLocation = useSwitchLocation();
  const [open, setOpen] = useState(false);

  const options = locationOptions(organizations, org?.id ?? null, locationId);
  if (options.length < 2) return null;

  return (
    <>
      <IconButton
        icon={MapPin}
        accessibilityLabel="Switch location"
        loading={switchLocation.isPending}
        onPress={() => setOpen(true)}
      />
      <SwitchLocationSheet
        open={open}
        onClose={() => setOpen(false)}
        options={options}
        onPick={(o) =>
          switchLocation.mutate({ organizationId: o.organizationId, locationId: o.locationId })
        }
      />
    </>
  );
}
