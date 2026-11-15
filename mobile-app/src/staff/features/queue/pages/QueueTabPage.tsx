import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader, SegmentedControl } from '@/core/components';
import { getPref, setPref } from '@/core/storage/prefs';
import { useAccess } from '@/staff/features/access';
import { NotificationBell } from '@/staff/features/notifications';

import { BoardView } from '../components/BoardView';
import { DoctorQueueView } from '../components/DoctorQueueView';

type QueueSegment = 'doctor' | 'board';

const SEGMENTS = [
  { value: 'doctor', label: 'My queue' },
  { value: 'board', label: 'Board' },
];

function readSegment(): QueueSegment {
  return getPref('staff.queue.segment') === 'board' ? 'board' : 'doctor';
}

/**
 * S-02 Queue tab (docs/06). Shows the doctor view, the reception board, or a
 * segmented switch when the user may use both (last choice remembered in
 * prefs). The two views live in their own files so the doctor screen (M1-08)
 * and the board (M1-09) can be built in parallel.
 */
export function QueueTabPage() {
  const router = useRouter();
  const { can } = useAccess();
  const canDoctor = can('queue.doctor.own');
  const canBoard = can('queue.board.view');
  const [segment, setSegment] = useState<QueueSegment>(readSegment);

  // A link (notification / push) may name the segment; it wins over the saved choice.
  const { segment: linked } = useLocalSearchParams<{ segment?: string }>();
  const requested: QueueSegment | null = linked === 'doctor' || linked === 'board' ? linked : null;

  const both = canDoctor && canBoard;
  const active: QueueSegment = both ? (requested ?? segment) : canBoard ? 'board' : 'doctor';

  const onChange = (value: string) => {
    const next: QueueSegment = value === 'board' ? 'board' : 'doctor';
    setSegment(next);
    router.setParams({ segment: next });
    setPref('staff.queue.segment', next);
  };

  return (
    <Screen header={<ScreenHeader title="Queue" back={false} actions={<NotificationBell />} />}>
      {both ? (
        <View className="px-4 pb-2">
          <SegmentedControl segments={SEGMENTS} value={active} onChange={onChange} />
        </View>
      ) : null}
      {active === 'board' ? <BoardView /> : <DoctorQueueView />}
    </Screen>
  );
}
