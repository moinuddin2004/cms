import { useRouter } from 'expo-router';
import { LayoutDashboard } from 'lucide-react-native';
import { useState } from 'react';

import { EmptyState, Screen, ScreenHeader } from '@/core/components';
import { AccessErrorState, useAccess, type PermissionKey } from '@/staff/features/access';
import { NotificationBell } from '@/staff/features/notifications';
import { useClinicToday } from '@/staff/lib/clinic-today';
import { formatInClinic } from '@/staff/lib/datetime';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { BlockShell } from '../components/BlockShell';
import {
  CollectionsTiles,
  DoctorsNowList,
  NextAppointmentsList,
  SKELETONS,
  StatsTiles,
} from '../components/TodayBlocks';
import {
  useDoctorsNow,
  useNextAppointments,
  useTodayCollections,
  useTodayStats,
} from '../hooks/useToday';
import { visibleTodayBlocks } from '../lib/today-blocks';

/** S-01 Today (docs/06): permitted blocks only, each with its own states; pull to refresh refetches all. */
export function TodayPage() {
  const router = useRouter();
  const { status, can, hasFeature } = useAccess();
  const org = useStaffAuthStore(activeOrganization);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const locationName = org?.locations.find((l) => l.id === locationId)?.name;

  const stats = useTodayStats();
  const collections = useTodayCollections();
  const doctors = useDoctorsNow();
  const next = useNextAppointments(5);
  const [refreshing, setRefreshing] = useState(false);

  const show = new Set(
    status === 'ready' ? visibleTodayBlocks((p) => can(p as PermissionKey), hasFeature) : [],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        [stats, collections, doctors, next].map((g) =>
          g.access === 'allowed' ? g.query.refetch() : undefined,
        ),
      );
    } finally {
      setRefreshing(false);
    }
  };

  const subtitle = [formatInClinic(useClinicToday(), 'EEE, MMM d'), locationName]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      header={
        <ScreenHeader
          title="Today"
          subtitle={subtitle}
          back={false}
          actions={<NotificationBell />}
        />
      }
      contentClassName="gap-4 pb-6">
      <AccessErrorState className="py-6" />
      {status === 'ready' && show.size === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Nothing to show here"
          description="Your role has no clinic overview. Use the Queue and Patients tabs."
        />
      ) : null}
      {show.has('stats') ? (
        <BlockShell gated={stats} skeleton={SKELETONS.tiles} errorTitle="Could not load numbers">
          {(s) => <StatsTiles stats={s} />}
        </BlockShell>
      ) : null}
      {show.has('collections') ? (
        <BlockShell
          gated={collections}
          skeleton={SKELETONS.tiles}
          errorTitle="Could not load collections">
          {(c) => <CollectionsTiles data={c} />}
        </BlockShell>
      ) : null}
      {show.has('doctors') ? (
        <BlockShell gated={doctors} skeleton={SKELETONS.rows} errorTitle="Could not load doctors">
          {(d) => <DoctorsNowList doctors={d} onOpen={() => router.navigate('/queue')} />}
        </BlockShell>
      ) : null}
      {show.has('next') ? (
        <BlockShell gated={next} skeleton={SKELETONS.rows} errorTitle="Could not load appointments">
          {(rows) => (
            <NextAppointmentsList rows={rows} onSeeAll={() => router.navigate('/schedule')} />
          )}
        </BlockShell>
      ) : null}
    </Screen>
  );
}
