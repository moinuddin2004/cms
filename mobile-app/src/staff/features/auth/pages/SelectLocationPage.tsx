import { useMutation } from '@tanstack/react-query';
import { ScrollView, View } from 'react-native';

import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';
import { apiErrorMessage } from '@/core/http/api-error';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { selectLocation } from '../api/auth.api';
import { useSignOut } from '../hooks/useSignOut';

/** Pick the clinic + location to work in (shown when the account has more than one). */
export function SelectLocationPage() {
  const organizations = useStaffAuthStore((s) => s.accessibleOrganizations);
  const setLocationContext = useStaffAuthStore((s) => s.setLocationContext);
  const signOut = useSignOut();

  const pick = useMutation({
    mutationFn: ({ orgId, locationId }: { orgId: string; locationId: string }) =>
      selectLocation(orgId, locationId),
    onSuccess: (r) => setLocationContext(r.activeOrganizationId, r.activeLocationId),
  });

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-6 px-6 py-safe">
      <View className="gap-1">
        <Text variant="h2" className="border-0 pb-0">
          Choose a location
        </Text>
        <Text variant="muted">Pick where you are working today.</Text>
      </View>

      {pick.isError ? (
        <Text className="text-destructive text-sm">
          {apiErrorMessage(pick.error, 'Could not open this location.')}
        </Text>
      ) : null}

      {organizations.map((org) => (
        <View key={org.id} className="gap-2">
          <Text className="text-sm font-semibold">{org.name}</Text>
          {org.signInBlock ? (
            <Text variant="muted">{org.signInBlock.message || 'This clinic cannot be opened right now.'}</Text>
          ) : (
            org.locations.map((loc) => (
              <Button
                key={loc.id}
                variant="outline"
                className="h-12 justify-start"
                disabled={pick.isPending}
                onPress={() => pick.mutate({ orgId: org.id, locationId: loc.id })}>
                <Text>{loc.name}</Text>
              </Button>
            ))
          )}
        </View>
      ))}

      <Button variant="ghost" disabled={signOut.isPending} onPress={() => signOut.mutate()}>
        <Text>Sign out</Text>
      </Button>
    </ScrollView>
  );
}
