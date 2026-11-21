import { Building2, MapPin } from 'lucide-react-native';
import { View } from 'react-native';

import { Avatar } from '@/core/components';
import { Icon } from '@/core/ui/icon';
import { Text } from '@/core/ui/text';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/** Who is signed in, and where (docs/06 S-08) — on the clinic's brand colour. */
export function ProfileCard() {
  const user = useStaffAuthStore((s) => s.user);
  const org = useStaffAuthStore(activeOrganization);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const location = org?.locations.find((l) => l.id === locationId);

  return (
    <View className="bg-primary overflow-hidden rounded-2xl p-5 shadow-md shadow-black/10">
      {/* Soft decorative circles; the brand colour carries the card. */}
      <View
        importantForAccessibility="no-hide-descendants"
        className="bg-primary-foreground/10 absolute -end-10 -top-12 size-40 rounded-full"
      />
      <View
        importantForAccessibility="no-hide-descendants"
        className="bg-primary-foreground/10 absolute -bottom-14 end-16 size-28 rounded-full"
      />

      <View className="flex-row items-center gap-4">
        <View className="border-primary-foreground/40 rounded-full border-2">
          <Avatar name={user?.name ?? '?'} imageUrl={user?.avatarUrl} size="lg" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-primary-foreground text-xl font-bold" numberOfLines={1}>
            {user?.name}
          </Text>
          <Text className="text-primary-foreground/80 text-sm" numberOfLines={1}>
            {user?.email}
          </Text>
        </View>
      </View>

      {org || location ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {org ? (
            <View className="bg-primary-foreground/15 flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
              <Icon as={Building2} className="text-primary-foreground size-3.5" />
              <Text className="text-primary-foreground text-xs font-medium" numberOfLines={1}>
                {org.name}
              </Text>
            </View>
          ) : null}
          {location ? (
            <View className="bg-primary-foreground/15 flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
              <Icon as={MapPin} className="text-primary-foreground size-3.5" />
              <Text className="text-primary-foreground text-xs font-medium" numberOfLines={1}>
                {location.name}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
