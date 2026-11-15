import { useRouter } from 'expo-router';
import { LayoutList, Plus, UserRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import {
  ActionSheet,
  EmptyState,
  ErrorState,
  FAB,
  LoadingSkeleton,
} from '@/core/components';
import { useCanMutate } from '@/core/http';
import { useAccess } from '@/staff/features/access';
import { RealtimeConnectionPill } from '@/staff/lib/realtime-connection-pill';

import { useBoard } from '../hooks/useBoard';
import { useOpenSession } from '../hooks/useSessionMutations';
import { BoardLaneList } from './board/BoardLaneList';
import { closedLaneDoctors, groupLane, openLanes, pickActiveLane } from './board/board-model';
import { DoctorChips } from './board/DoctorChips';
import { EntryActionsHost } from './board/EntryActionsHost';
import { buildLaneItems } from './board/lane-items';
import { TicketSheet } from './board/TicketSheet';
import { useBoardActions } from './board/useBoardActions';
import { useBoardUiStore } from './board/useBoardUiStore';

const FOCUS_HIGHLIGHT_MS = 4000;

/**
 * S-02b reception board (docs/06): doctor chips with waiting counts, `[+]` to
 * open a lane, the chosen lane's now-serving line, waiting list and on-hold /
 * skipped section, a row ActionSheet per the status x permission table, the
 * ticket sheet and the walk-in FAB. Live while mounted (`useBoard`).
 */
export function BoardView() {
  const router = useRouter();
  const { can } = useAccess();
  const canMutate = useCanMutate();
  const board = useBoard();
  const actions = useBoardActions();
  const openSession = useOpenSession();

  const {
    selectedDoctorId,
    focusEntryId,
    ticketEntryId,
    selectDoctor,
    openActions,
    startFlow,
    endFlow,
    flow,
    hideTicket,
    clearFocus,
  } = useBoardUiStore();

  useEffect(() => {
    if (!focusEntryId) return;
    const timer = setTimeout(clearFocus, FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [focusEntryId, clearFocus]);

  if (board.isPending) return <LoadingSkeleton className="flex-1" />;
  if (board.isError) return <ErrorState onRetry={() => void board.refetch()} className="flex-1 justify-center" />;

  const data = board.data;
  const lanes = openLanes(data);
  const closed = closedLaneDoctors(data);
  const lane = pickActiveLane(lanes, selectedDoctorId);
  const canWalkIn = can('queue.checkin');

  const openLaneFor = (doctorId: string) =>
    openSession.mutate({ doctorId }, { onSuccess: () => selectDoctor(doctorId) });

  const laneSheet = (
    <ActionSheet
      open={flow?.kind === 'open-lane'}
      onClose={endFlow}
      title="Open a lane for"
      cancelLabel="Close"
      actions={closed.map((d) => ({
        label: d.fullName,
        icon: UserRound,
        onPress: () => openLaneFor(d.id),
      }))}
    />
  );

  if (data.lanes.length === 0) {
    return (
      <EmptyState
        icon={LayoutList}
        title="No doctors on the board"
        description="Doctors with a schedule at this location appear here."
        className="flex-1 justify-center"
      />
    );
  }

  if (!lane) {
    return (
      <View className="flex-1">
        <EmptyState
          icon={LayoutList}
          title="No open lanes"
          description="Open a lane for a doctor to start taking patients."
          // The server lets only `queue.checkin` (or that doctor) open a session.
          actionLabel={canMutate && canWalkIn ? 'Open a lane' : undefined}
          onAction={() => startFlow({ kind: 'open-lane' })}
          className="flex-1 justify-center"
        />
        {laneSheet}
      </View>
    );
  }

  const groups = groupLane(lane.snapshot);
  // Arrivals check in through `queue.checkin`, the same permission as a walk-in.
  const items = buildLaneItems(lane.snapshot.session, groups, canWalkIn);
  const doctors = data.lanes.map((l) => l.doctor);

  return (
    <View className="flex-1">
      <View className="gap-2 pb-2">
        <View className="px-4">
          <RealtimeConnectionPill />
        </View>
        <DoctorChips
          lanes={lanes}
          activeDoctorId={lane.doctor.id}
          onSelect={selectDoctor}
          onOpenLane={
            closed.length > 0 && canWalkIn ? () => startFlow({ kind: 'open-lane' }) : undefined
          }
          openLaneDisabled={!canMutate || openSession.isPending}
        />
      </View>
      <BoardLaneList
        lane={lane}
        items={items}
        nowIso={lane.snapshot.now}
        pendingEntryId={actions.pendingEntryId}
        focusEntryId={focusEntryId}
        refreshing={board.isRefetching}
        onRefresh={() => void board.refetch()}
        onOpenArrivals={() => router.push('/queue/arrivals')}
        onOpenActions={(entry) => openActions(entry.id)}
        onBackFromTest={(entry) => void actions.backFromTest(entry).catch(() => undefined)}
      />
      {canWalkIn ? (
        <FAB
          icon={Plus}
          label="Walk-in"
          extended
          disabled={!canMutate}
          onPress={() =>
            router.push({ pathname: '/queue/walk-in', params: { doctorId: lane.doctor.id } })
          }
        />
      ) : null}
      <EntryActionsHost lane={lane} doctors={doctors} actions={actions} />
      {laneSheet}
      <TicketSheet entryId={ticketEntryId} onClose={hideTicket} />
    </View>
  );
}
