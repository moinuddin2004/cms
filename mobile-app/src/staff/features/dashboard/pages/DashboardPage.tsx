import { ScrollView, View } from 'react-native';

import { ErrorState } from '@/core/components/feedback/ErrorState';
import { LoadingSkeleton } from '@/core/components/feedback/LoadingSkeleton';
import { Button } from '@/core/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/ui/card';
import { Text } from '@/core/ui/text';
import { useAccess } from '@/staff/features/access';
import { useSignOut } from '@/staff/features/auth';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/** Placeholder home: proves auth, tenant headers and access loading end to end. */
export function DashboardPage() {
  const user = useStaffAuthStore((s) => s.user);
  const org = useStaffAuthStore(activeOrganization);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const access = useAccess();
  const signOut = useSignOut();

  const location = org?.locations.find((l) => l.id === locationId);

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 px-4 py-safe">
      <View className="gap-1">
        <Text variant="h3">Hello, {user?.name}</Text>
        <Text variant="muted">
          {org?.name} · {location?.name}
        </Text>
      </View>

      {access.status === 'loading' ? <LoadingSkeleton rows={3} /> : null}
      {access.status === 'error' ? <ErrorState onRetry={access.refetch} /> : null}
      {access.status === 'ready' ? (
        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>
              {access.isOwner ? 'Owner' : access.isSuperAdmin ? 'Super admin' : 'Staff'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Text variant="muted">
              Can view patients: {access.can('patients.view') ? 'yes' : 'no'}
            </Text>
          </CardContent>
        </Card>
      ) : null}

      <Button variant="outline" disabled={signOut.isPending} onPress={() => signOut.mutate()}>
        <Text>{signOut.isPending ? 'Signing out…' : 'Sign out'}</Text>
      </Button>
    </ScrollView>
  );
}
