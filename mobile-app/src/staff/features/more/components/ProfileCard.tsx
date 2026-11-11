import { View } from 'react-native';

import { Avatar } from '@/core/components';
import { Text } from '@/core/ui/text';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/** Who is signed in, and where (docs/06 S-08). */
export function ProfileCard() {
  const user = useStaffAuthStore((s) => s.user);
  const org = useStaffAuthStore(activeOrganization);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const location = org?.locations.find((l) => l.id === locationId);

  return (
    <View className="bg-card border-border flex-row items-center gap-3 rounded-xl border p-4">
      <Avatar name={user?.name ?? '?'} imageUrl={user?.avatarUrl} size="lg" />
      <View className="flex-1 gap-0.5">
        <Text variant="large" numberOfLines={1}>
          {user?.name}
        </Text>
        <Text variant="muted" numberOfLines={1}>
          {user?.email}
        </Text>
        <Text variant="muted" numberOfLines={2}>
          {[org?.name, location?.name].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}
