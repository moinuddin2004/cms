import { FlashList } from '@shopify/flash-list';
import { CalendarX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingSkeleton,
  NoResultsState,
  Screen,
  ScreenHeader,
} from '@/core/components';
import { useCanMutate } from '@/core/http';
import { Text } from '@/core/ui/text';
import { useAccess } from '@/staff/features/access';
import { NotificationBell } from '@/staff/features/notifications';
import { useClinicToday } from '@/staff/lib/clinic-today';
import { formatInClinic, formatYmd, useClinicTimezone } from '@/staff/lib/datetime';

import { AppointmentSheet } from '../components/AppointmentSheet';
import { DayStrip } from '../components/DayStrip';
import { LateWalkInDialog } from '../components/LateWalkInDialog';
import { ScheduleRow } from '../components/ScheduleRow';
import { useDayAppointments, useDoctors } from '../hooks/useAppointments';
import { useCheckInFlow } from '../hooks/useCheckInFlow';
import { canCheckIn } from '../lib/checkin-rule';
import { dayStrip } from '../lib/day-strip';
import { groupByHour } from '../lib/group-by-hour';
import { STATUS_FILTER_OPTIONS, buildScheduleList, type ScheduleItem } from '../lib/schedule-view';
import type { AppointmentListItem, AppointmentStatus } from '../types/appointments.types';

/** Lives above the selected day, so switching days keeps the filters. */
interface ScheduleFilters {
  doctorId?: string;
  status?: AppointmentStatus;
}

const STATUS_VALUES = new Set<string>(STATUS_FILTER_OPTIONS.map((o) => o.value));

function HourHeader({ label, count }: { label: string; count: number }) {
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${label}, ${count} appointment${count === 1 ? '' : 's'}`}
      className="bg-muted min-h-11 flex-row items-center justify-between px-4 py-2">
      <Text className="text-sm font-semibold">{label}</Text>
      <Text variant="muted">{count}</Text>
    </View>
  );
}

/**
 * S-06 Schedule tab (docs/06): day strip (yesterday … +6 on the clinic clock),
 * doctor + status chips, the day's appointments grouped by hour, and a
 * read-only sheet with [Check in] when allowed. Own-scope doctors only get
 * their own rows — the server does that.
 */
export function ScheduleTabPage() {
  const { can } = useAccess();
  const zone = useClinicTimezone();
  const today = useClinicToday();
  const canMutate = useCanMutate();

  const days = useMemo(() => dayStrip(today), [today]);
  const [picked, setPicked] = useState<string | null>(null);
  // A day that fell off the strip (the clinic midnight passed) falls back to today.
  const day = picked && days.includes(picked) ? picked : today;

  const [filters, setFilters] = useState<ScheduleFilters>({});
  const doctors = useDoctors().data;
  // A doctor from another location (after a location switch) is not a filter here.
  const doctorId =
    filters.doctorId && doctors && !doctors.some((d) => d.id === filters.doctorId)
      ? undefined
      : filters.doctorId;
  const active: ScheduleFilters = { doctorId, status: filters.status };
  const filterCount = (active.doctorId ? 1 : 0) + (active.status ? 1 : 0);

  const query = useDayAppointments(day, active);
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);
  const list = useMemo(() => buildScheduleList(groupByHour(rows, zone)), [rows, zone]);

  const [sheet, setSheet] = useState<{ row: AppointmentListItem; open: boolean } | null>(null);
  const closeSheet = () => setSheet((s) => (s ? { ...s, open: false } : s));
  const flow = useCheckInFlow(closeSheet);
  // The list refetches after a check-in: show the newest copy of the open row.
  const sheetRow = sheet ? (rows.find((r) => r.id === sheet.row.id) ?? sheet.row) : null;
  const allowCheckIn =
    !!sheetRow && canCheckIn(sheetRow, { permitted: can('queue.checkin'), today, zone });

  const clearFilters = () => setFilters({});
  const savedAt = query.dataUpdatedAt ? formatInClinic(query.dataUpdatedAt, 'HH:mm') : undefined;
  const doctorOptions = (doctors ?? []).map((d) => ({
    value: d.id,
    label: d.fullName || 'No name',
  }));

  let body;
  if (query.isPending) {
    body = <LoadingSkeleton />;
  } else if (query.isError && rows.length === 0) {
    body = <ErrorState onRetry={() => void query.refetch()} />;
  } else if (rows.length === 0) {
    body =
      filterCount > 0 ? (
        <NoResultsState onClear={clearFilters} />
      ) : (
        <EmptyState
          icon={CalendarX}
          title="No appointments"
          description={`Nothing is booked for ${formatYmd(day, 'EEEE, MMM d')}.`}
        />
      );
  } else {
    body = (
      <FlashList<ScheduleItem>
        data={list.items}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.type}
        stickyHeaderIndices={list.headerIndices}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <HourHeader label={item.label} count={item.count} />
          ) : (
            <ScheduleRow row={item.row} onPress={() => setSheet({ row: item.row, open: true })} />
          )
        }
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        ListHeaderComponent={
          query.isError ? (
            <Text variant="muted" className="px-4 py-2" accessibilityRole="alert">
              Could not refresh. Pull down to try again.
            </Text>
          ) : null
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <Text variant="muted" className="px-4 py-3 text-center">
              Loading more…
            </Text>
          ) : null
        }
      />
    );
  }

  return (
    <Screen
      savedAt={savedAt}
      header={<ScreenHeader title="Schedule" back={false} actions={<NotificationBell />} />}>
      <View className="gap-3 pb-2">
        <DayStrip days={days} selected={day} today={today} onSelect={setPicked} />
        {doctorOptions.length > 0 ? (
          <FilterChips
            options={doctorOptions}
            value={active.doctorId ? [active.doctorId] : []}
            onChange={(v) => setFilters((f) => ({ ...f, doctorId: v[0] }))}
          />
        ) : null}
        <FilterChips
          options={STATUS_FILTER_OPTIONS}
          value={active.status ? [active.status] : []}
          onChange={(v) =>
            setFilters((f) => ({
              ...f,
              status: v[0] && STATUS_VALUES.has(v[0]) ? (v[0] as AppointmentStatus) : undefined,
            }))
          }
          clearLabel={filterCount > 0 ? 'Clear' : undefined}
        />
      </View>
      <View className="flex-1">{body}</View>
      <AppointmentSheet
        row={sheetRow}
        open={!!sheet?.open}
        onClose={closeSheet}
        allowCheckIn={allowCheckIn}
        onCheckIn={() => sheetRow && flow.start(sheetRow.id)}
        checkingIn={flow.checkingIn}
        offline={!canMutate}
      />
      <LateWalkInDialog open={flow.lateOpen} onClose={flow.dismissLate} onConfirm={flow.convert} />
    </Screen>
  );
}
