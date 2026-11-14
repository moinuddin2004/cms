import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { BoardResponse, EntryView } from '../types/queue.types';
import { useBoardUiStore } from './board/useBoardUiStore';
import { BoardView } from './BoardView';

jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: unknown) => ({ value: v }),
    useReducedMotion: () => true,
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { BottomSheetTextInput: RN.TextInput };
});
jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));

let mockPerms: string[] = [];
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({ can: (p?: string | null) => !p || mockPerms.includes(p) }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));

jest.mock('@/staff/lib/realtime-connection-pill', () => ({ RealtimeConnectionPill: () => null }));

const mockRefetch = jest.fn();
let mockBoard: Record<string, unknown> = {};
jest.mock('../hooks/useBoard', () => ({ useBoard: () => mockBoard }));

const mockOpenMutate = jest.fn();
jest.mock('../hooks/useSessionMutations', () => ({
  useOpenSession: () => ({ mutate: mockOpenMutate, isPending: false }),
}));

const mockActions = {
  pendingEntryId: null as string | null,
  skip: jest.fn(),
  rejoin: jest.fn(),
  backFromTest: jest.fn(() => Promise.resolve()),
  cancel: jest.fn(),
  transfer: jest.fn(),
  markUrgent: jest.fn(),
};
jest.mock('./board/useBoardActions', () => ({ useBoardActions: () => mockActions }));

jest.mock('../hooks/useTicket', () => ({
  useTicket: () => ({ isPending: true, isError: false }),
}));

// Native sheets stand in as plain views (the real ones need the gesture runtime).
jest.mock('@/core/components/overlays/ActionSheet', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ActionSheet: ({
      open,
      title,
      actions,
    }: {
      open: boolean;
      title?: string;
      actions: { label: string; onPress: () => void }[];
    }) =>
      open ? (
        <RN.View>
          <RN.Text>{`sheet:${title}`}</RN.Text>
          {actions.map((a) => (
            <RN.Pressable key={a.label} accessibilityRole="button" onPress={a.onPress}>
              <RN.Text>{a.label}</RN.Text>
            </RN.Pressable>
          ))}
        </RN.View>
      ) : null,
  };
});
jest.mock('@/core/components/overlays/FormSheet', () => ({ FormSheet: () => null }));
jest.mock('@/core/components/overlays/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/core/components/feedback/ConnectionPill', () => ({ ConnectionPill: () => null }));
jest.mock('@shopify/flash-list', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: ({
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem: (i: { item: unknown; index: number }) => React.ReactNode;
    }) => (
      <RN.View>
        {data.map((item, index) => (
          <RN.View key={index}>{renderItem({ item, index })}</RN.View>
        ))}
      </RN.View>
    ),
  };
});

const NOW = '2026-11-15T10:00:00Z';

function entry(id: string, status: EntryView['status'], extra: Partial<EntryView> = {}): EntryView {
  return {
    id,
    sessionId: 's1',
    token: `A-${id}`,
    status,
    queueType: 'walk_in',
    priorityClass: 'normal',
    checkedInAt: '2026-11-15T09:45:00Z',
    scheduledStart: null,
    reasonForVisit: null,
    patient: { id: `p-${id}`, fullName: `Patient ${id}`, phone: null, patientNumber: null },
    version: 3,
    ...extra,
  } as EntryView;
}

function lane(id: string, entries: EntryView[], waitingOrder: string[]) {
  return {
    doctor: { id, fullName: `Dr ${id}`, designation: '', profilePictureUrl: null, tokenPrefix: 'A' },
    snapshot: {
      session: { id: 's1', status: 'open', pauseReason: null },
      entries,
      waitingOrder,
      suggestion: null,
      now: NOW,
    },
  };
}
const closedLane = (id: string) => ({ ...lane(id, [], []), snapshot: null });

function setBoard(lanes: unknown[]) {
  mockBoard = {
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: mockRefetch,
    data: { serviceDate: '2026-11-15', now: NOW, lanes } as unknown as BoardResponse,
  };
}

const FULL = ['queue.checkin', 'queue.entry.manage', 'queue.entry.reprioritize', 'patients.view'];

describe('BoardView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerms = FULL;
    mockActions.pendingEntryId = null;
    useBoardUiStore.setState(useBoardUiStore.getInitialState());
  });

  it('shows a skeleton while loading (no empty or error copy)', async () => {
    mockBoard = { isPending: true, isError: false };
    await render(<BoardView />);
    expect(screen.queryByText('No doctors on the board')).toBeNull();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('shows the error state with a working retry', async () => {
    mockBoard = { isPending: false, isError: true, refetch: mockRefetch };
    await render(<BoardView />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows the empty state when the location has no doctors', async () => {
    setBoard([]);
    await render(<BoardView />);
    expect(screen.getByText('No doctors on the board')).toBeTruthy();
  });

  it('opens a lane: no open lanes -> picker -> POST /queue/sessions for that doctor', async () => {
    setBoard([closedLane('d1'), closedLane('d2')]);
    await render(<BoardView />);
    await fireEvent.press(screen.getByText('Open a lane'));
    expect(screen.getByText('Dr d2')).toBeTruthy();
    await fireEvent.press(screen.getByText('Dr d2'));
    expect(mockOpenMutate).toHaveBeenCalledTimes(1);
    expect(mockOpenMutate.mock.calls[0][0]).toEqual({ doctorId: 'd2' });

    // On success the new lane is the one shown.
    await act(async () => mockOpenMutate.mock.calls[0][1].onSuccess());
    expect(useBoardUiStore.getState().selectedDoctorId).toBe('d2');
  });

  it('the [+] chip opens a picker of only the doctors without a session', async () => {
    setBoard([lane('d1', [], []), closedLane('d2')]);
    await render(<BoardView />);
    await fireEvent.press(screen.getByLabelText('Open a lane for another doctor'));
    expect(screen.getByText('sheet:Open a lane for')).toBeTruthy();
    expect(screen.getByText('Dr d2')).toBeTruthy();
  });

  it('renders chips with waiting counts and the lane sections', async () => {
    setBoard([
      lane(
        'd1',
        [
          entry('1', 'in_consultation'),
          entry('2', 'waiting'),
          entry('3', 'waiting', { priorityClass: 'authorized_urgent' }),
          entry('4', 'on_hold'),
          entry('5', 'skipped'),
        ],
        ['3', '2'],
      ),
      lane('d2', [entry('9', 'waiting')], ['9']),
    ]);
    await render(<BoardView />);
    expect(screen.getByLabelText('Dr d1, 2 waiting')).toBeTruthy();
    expect(screen.getByLabelText('Dr d2, 1 waiting')).toBeTruthy();
    for (const t of ['Now serving', 'Waiting', 'On hold / Skipped']) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    // Urgent first (server order), walk-in wait from the server clock, urgent badge.
    expect(screen.getAllByText('walk-in 15m').length).toBeGreaterThan(0);
    const order = screen.getAllByText(/^Patient \d$/).map((n) => n.props.children);
    expect(order.indexOf('Patient 3')).toBeLessThan(order.indexOf('Patient 2'));
    expect(screen.getAllByText('Urgent').length).toBe(1);
    expect(screen.getByText('Sent for test')).toBeTruthy();
    expect(screen.queryByText('Patient 9')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Dr d2, 1 waiting'));
    expect(await screen.findByText('Patient 9')).toBeTruthy();
  });

  it('an empty lane still shows its sections with short lines', async () => {
    setBoard([lane('d1', [], [])]);
    await render(<BoardView />);
    expect(screen.getByText('No one with the doctor.')).toBeTruthy();
    expect(screen.getByText('No one is waiting.')).toBeTruthy();
  });

  it('Back from test sends that entry', async () => {
    const held = entry('4', 'on_hold');
    setBoard([lane('d1', [held], [])]);
    await render(<BoardView />);
    await fireEvent.press(screen.getByLabelText('Back from test'));
    expect(mockActions.backFromTest).toHaveBeenCalledWith(held);
  });

  it('the row menu lists the permitted actions; mark urgent is hidden when already urgent', async () => {
    setBoard([
      lane(
        'd1',
        [entry('2', 'waiting'), entry('3', 'waiting', { priorityClass: 'authorized_urgent' })],
        ['2', '3'],
      ),
    ]);
    await render(<BoardView />);

    await fireEvent.press(screen.getByLabelText('Actions for A-2 Patient 2'));
    expect(screen.getByText('Mark urgent')).toBeTruthy();
    expect(screen.getByText('Transfer to doctor')).toBeTruthy();
    expect(screen.getByText('Cancel visit')).toBeTruthy();
    expect(screen.getByText('Patient file')).toBeTruthy();
    expect(screen.getByText('Show ticket')).toBeTruthy();

    // Show ticket sets the ticket target.
    await fireEvent.press(screen.getByText('Show ticket'));
    expect(useBoardUiStore.getState().ticketEntryId).toBe('2');

    await fireEvent.press(screen.getByLabelText('Actions for A-3 Patient 3'));
    expect(screen.queryByText('Mark urgent')).toBeNull();
    expect(screen.getByText('Cancel visit')).toBeTruthy();
  });

  it('the row is disabled while an action on it is pending', async () => {
    setBoard([lane('d1', [entry('2', 'waiting')], ['2'])]);
    mockActions.pendingEntryId = '2';
    await render(<BoardView />);
    expect(screen.getByLabelText('Actions for A-2 Patient 2')).toBeDisabled();
  });

  it('walk-in FAB: only with queue.checkin, opens the route with the lane doctor', async () => {
    setBoard([lane('d1', [], [])]);
    await render(<BoardView />);
    await fireEvent.press(screen.getByLabelText('Walk-in'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/queue/walk-in', params: { doctorId: 'd1' } });
  });

  it('hides the Arrivals row until the arrivals screen exists (M1-10)', async () => {
    setBoard([lane('d1', [], [])]);
    await render(<BoardView />);
    expect(screen.queryByText('Arrivals')).toBeNull();
  });

  it('without queue.checkin there is no [+] chip to open a lane', async () => {
    mockPerms = ['queue.board.view'];
    setBoard([lane('d1', [], []), closedLane('d2')]);
    await render(<BoardView />);
    expect(screen.queryByLabelText('Open a lane for another doctor')).toBeNull();
  });

  it('without queue.checkin the empty board has no "Open a lane" button', async () => {
    mockPerms = ['queue.board.view'];
    setBoard([closedLane('d1')]);
    await render(<BoardView />);
    expect(screen.getByText('No open lanes')).toBeTruthy();
    expect(screen.queryByText('Open a lane')).toBeNull();
  });

  it('no walk-in FAB and no arrivals link without queue.checkin', async () => {
    mockPerms = ['queue.board.view'];
    setBoard([lane('d1', [], [])]);
    await render(<BoardView />);
    expect(screen.queryByLabelText('Walk-in')).toBeNull();
    expect(screen.queryByText('Arrivals')).toBeNull();
  });
});
