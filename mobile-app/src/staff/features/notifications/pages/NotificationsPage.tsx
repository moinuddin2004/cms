import { FlashList } from '@shopify/flash-list';
import { useRouter, type Href } from 'expo-router';
import { Bell, CheckCheck } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';

import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  Screen,
  ScreenHeader,
  Spinner,
} from '@/core/components';
import { useStableCallback } from '@/core/hooks/use-stable-callback';
import { Button } from '@/core/ui/button';
import { Text } from '@/core/ui/text';
import { useSwitchLocation } from '@/staff/features/more/hooks/useSwitchLocation';
import { resolveStaffLink, type StaffRoute } from '@/staff/lib/link-router';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { NotificationRow } from '../components/NotificationRow';
import {
  useMarkAllRead,
  useMarkRead,
  useNotificationsInfinite,
  useUnreadCount,
} from '../hooks/useNotifications';
import { clinicSwitchTarget, orgNameMap } from '../lib/clinic-switch-target';
import { describeNotification } from '../lib/notification-row';
import type { NotificationItem } from '../types/notifications.types';

interface PendingSwitch {
  organizationId: string;
  clinicName: string;
  route: StaffRoute;
}

const keyOf = (r: { id: string }) => r.id;

/** S-07 Notifications inbox: infinite list, mark read / all, link routing, other-clinic prompt. */
export function NotificationsPage() {
  const router = useRouter();
  const query = useNotificationsInfinite();
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const switchLocation = useSwitchLocation();
  const organizations = useStaffAuthStore((s) => s.accessibleOrganizations);
  const activeOrgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const [pending, setPending] = useState<PendingSwitch | null>(null);
  const [pulling, setPulling] = useState(false);

  const orgNames = useMemo(() => orgNameMap(organizations), [organizations]);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);

  // Models are built once per data change so memoised rows keep their props.
  const rows = useMemo(
    () => items.map((item) => ({ id: item.id, item, model: describeNotification(item, activeOrgId, orgNames) })),
    [items, activeOrgId, orgNames],
  );

  // Disabled only when we KNOW nothing is unread: a loading or failed count must not lock the button.
  const nothingUnread =
    unread.data === 0 || (unread.data === undefined && items.length > 0 && items.every((n) => n.readAt !== null));

  const go = (route: StaffRoute) => router.navigate(route as Href);

  const open = (item: NotificationItem) => {
    if (item.readAt === null) markRead.mutate(item.id);
    const route = resolveStaffLink(item.link);
    if (!route) return; // unknown link: stay here
    const model = describeNotification(item, activeOrgId, orgNames);
    if (model.otherClinic) {
      setPending({ organizationId: item.organizationId, clinicName: model.otherClinic, route });
      return;
    }
    go(route);
  };

  const openById = useStableCallback((id: string) => {
    const item = items.find((n) => n.id === id);
    if (item) open(item);
  });

  const confirmSwitch = async () => {
    if (!pending) return;
    const target = clinicSwitchTarget(organizations, pending.organizationId);
    if (!target) {
      toast.error('You cannot open that clinic from this device.');
      return;
    }
    // Rejects on failure (the hook already toasted) so the dialog stays open for a retry.
    await switchLocation.mutateAsync(target);
    go(pending.route);
  };

  const onEndReached = () => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) {
      void query.fetchNextPage();
    }
  };

  let body;
  if (query.isPending) {
    body = <LoadingSkeleton />;
  } else if (query.isError && items.length === 0) {
    body = <ErrorState onRetry={() => void query.refetch()} className="flex-1 justify-center" />;
  } else {
    body = (
      <FlashList
        data={rows}
        keyExtractor={keyOf}
        renderItem={({ item }) => (
          <NotificationRow id={item.id} model={item.model} onPress={openById} />
        )}
        refreshing={pulling}
        onRefresh={() => {
          setPulling(true);
          void query.refetch().finally(() => setPulling(false));
        }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="New notifications from your clinics will appear here."
          />
        }
        ListFooterComponent={
          query.isFetchNextPageError ? (
            <View className="items-center gap-1 py-4">
              <Text variant="muted">Could not load more</Text>
              <Button
                variant="outline"
                className="min-h-11"
                onPress={() => void query.fetchNextPage()}>
                <Text>Retry</Text>
              </Button>
            </View>
          ) : query.isFetchingNextPage ? (
            <View
              accessibilityRole="progressbar"
              className="flex-row items-center justify-center gap-2 py-4">
              <Spinner />
              <Text variant="muted">Loading more…</Text>
            </View>
          ) : null
        }
      />
    );
  }

  return (
    <Screen
      header={
        <ScreenHeader
          title="Notifications"
          actions={
            <IconButton
              icon={CheckCheck}
              accessibilityLabel="Mark all as read"
              loading={markAll.isPending}
              disabled={nothingUnread}
              onPress={() => markAll.mutate()}
            />
          }
        />
      }>
      {query.isRefetchError && items.length > 0 ? (
        <ErrorState
          title="Could not refresh"
          message="Showing the notifications already loaded."
          onRetry={() => void query.refetch()}
          className="py-4"
        />
      ) : null}
      <View className="flex-1">{body}</View>
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Switch to ${pending.clinicName}?` : 'Switch clinic?'}
        description="This notification belongs to another clinic. Switching changes the clinic you are working in."
        confirmLabel="Switch"
        cancelLabel="Cancel"
        onConfirm={confirmSwitch}
      />
    </Screen>
  );
}
