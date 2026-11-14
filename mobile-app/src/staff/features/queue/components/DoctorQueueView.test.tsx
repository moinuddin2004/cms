import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { EntryStatus, EntryView, SessionSnapshot, SessionStatus } from '../types/queue.types';
import { DoctorQueueView } from './DoctorQueueView';

// ─── Native / provider stand-ins ────────────────────────────────

// Native runtimes the core kit imports at load time (the sheets themselves are replaced below).
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('@gorhom/bottom-sheet', () => ({}));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    withRepeat: () => 0,
    withTiming: () => 0,
  };
});

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/core/http/use-can-mutate', () => ({ useCanMutate: () => true }));
jest.mock('@/staff/lib/realtime-connection-pill', () => ({ RealtimeConnectionPill: () => null }));
jest.mock('@/staff/lib/datetime', () => ({ formatTime: () => '10:30 AM' }));
jest.mock('@shopify/flash-list', () => ({
  FlashList: (p: {
    data: unknown[];
    renderItem: (a: { item: unknown }) => ReactNode;
    ListHeaderComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
    ListEmptyComponent?: ReactNode;
  }) => {
    const { View } = jest.requireActual('react-native');
    return (
      <View>
        {p.ListHeaderComponent}
        {p.data.length
          ? p.data.map((item, i) => <View key={i}>{p.renderItem({ item })}</View>)
          : p.ListEmptyComponent}
        {p.ListFooterComponent}
      </View>
    );
  },
}));
// The real sheets need the native gesture runtime: render their content inline when open.
jest.mock('@/core/components', () => {
  const actual = jest.requireActual('@/core/components');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    ...actual,
    FormSheet: (p: {
      open: boolean;
      title: string;
      children: ReactNode;
      submit?: { label: string; onPress: () => void; disabled?: boolean };
    }) =>
      p.open ? (
        <View>
          <Text>{p.title}</Text>
          {p.children}
          {p.submit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`submit ${p.submit.label}`}
              accessibilityState={{ disabled: !!p.submit.disabled }}
              disabled={p.submit.disabled}
              onPress={p.submit.onPress}>
              <Text>{p.submit.label}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null,
    ActionSheet: (p: { open: boolean; actions: { label: string; onPress: () => void }[] }) =>
      p.open ? (
        <View>
          {p.actions.map((a) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress}>
              <Text>{`menu: ${a.label}`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null,
  };
});

let mockPerms: string[] = [];
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({ can: (perm?: string | null) => !perm || mockPerms.includes(perm) }),
}));

const mockPush = jest.fn();
let mockSnapshot: SessionSnapshot | undefined;
let mockQueryError = false;
const mockRefetch = jest.fn().mockResolvedValue(undefined);
jest.mock('../hooks/useMySession', () => ({
  useMySession: () => ({ data: mockSnapshot, isError: mockQueryError, refetch: mockRefetch }),
}));

const mockActions = {
  busyEntryIds: new Set<string>(),
  sessionBusy: false,
  startSession: jest.fn(),
  resumeSession: jest.fn(),
  pauseSession: jest.fn().mockResolvedValue(true),
  setSmartOrder: jest.fn(),
  callNext: jest.fn(),
  startConsultation: jest.fn(),
  complete: jest.fn(),
  recall: jest.fn(),
  undoCall: jest.fn(),
  skip: jest.fn(),
  sendForTest: jest.fn().mockResolvedValue(true),
  abort: jest.fn().mockResolvedValue(true),
  select: jest.fn().mockResolvedValue(true),
};
jest.mock('./doctor/useDoctorQueueActions', () => ({
  useDoctorQueueActions: () => mockActions,
}));

// ─── Fixtures ───────────────────────────────────────────────────

function entry(id: string, status: EntryStatus, extra: Partial<EntryView> = {}): EntryView {
  return {
    id,
    sessionId: 's1',
    token: `A-${id.toUpperCase()}`,
    tokenNumber: 1,
    queueType: 'walk_in',
    status,
    priorityClass: 'normal',
    patient: { id: `p-${id}`, fullName: `Patient ${id}`, phone: null, patientNumber: null },
    reasonForVisit: 'Toothache',
    checkedInAt: '2026-11-15T08:00:00.000Z',
    version: 4,
    ...extra,
  } as EntryView;
}

function snapshot(
  status: SessionStatus,
  entries: EntryView[],
  extra: Partial<SessionSnapshot> = {},
): SessionSnapshot {
  return {
    session: {
      id: 's1',
      status,
      pauseReason: null,
      smartQueueEnabled: true,
    } as SessionSnapshot['session'],
    entries,
    waitingOrder: entries.filter((e) => e.status === 'waiting').map((e) => e.id),
    suggestion: null,
    now: '2026-11-15T08:30:00.000Z',
    ...extra,
  };
}

const press = async (name: string | RegExp) =>
  fireEvent.press(screen.getByRole('button', { name }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPerms = ['queue.doctor.own', 'patients.view'];
  mockQueryError = false;
  mockActions.busyEntryIds = new Set();
  mockActions.sessionBusy = false;
  mockSnapshot = snapshot('open', [entry('w1', 'waiting'), entry('w2', 'waiting')]);
});
afterEach(async () => {
  await cleanup();
});

describe('DoctorQueueView — session states', () => {
  it('open: summary, waiting rows in order, sticky Call next', async () => {
    mockSnapshot = snapshot('open', [entry('w1', 'waiting'), entry('w2', 'waiting')], {
      suggestion: { entryId: 'w1', reason: 'APPOINTMENT_DUE' },
    });
    await render(<DoctorQueueView />);
    expect(screen.getByText('Session open · 2 waiting')).toBeOnTheScreen();
    expect(screen.getByText('Patient w1')).toBeOnTheScreen();
    expect(screen.getByText('Next suggested: A-W1')).toBeOnTheScreen();
    expect(screen.getByText('Appointment due')).toBeOnTheScreen();
    await press('Call next');
    expect(mockActions.callNext).toHaveBeenCalledWith('s1');
  });

  it('open with nobody waiting shows the empty message', async () => {
    mockSnapshot = snapshot('open', []);
    await render(<DoctorQueueView />);
    expect(screen.getByText('No one is waiting')).toBeOnTheScreen();
  });

  it('waiting_for_doctor: Start session', async () => {
    mockSnapshot = snapshot('waiting_for_doctor', []);
    await render(<DoctorQueueView />);
    expect(screen.getByText("Your session hasn't started")).toBeOnTheScreen();
    expect(screen.queryByText('Call next')).toBeNull();
    await press('Start session');
    expect(mockActions.startSession).toHaveBeenCalledWith('s1');
  });

  it('paused: banner with the reason, Resume works, Call next disabled', async () => {
    mockSnapshot = snapshot('paused', [entry('w1', 'waiting')]);
    mockSnapshot.session.pauseReason = 'Lunch';
    await render(<DoctorQueueView />);
    expect(screen.getByText('Paused — Lunch')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Call next' })).toBeDisabled();
    await press('Resume');
    expect(mockActions.resumeSession).toHaveBeenCalledWith('s1');
  });

  it('closed: summary counts, no actions', async () => {
    mockSnapshot = snapshot('closed', [
      entry('a', 'completed'),
      entry('b', 'completed'),
      entry('c', 'aborted'),
      entry('d', 'skipped'),
    ]);
    await render(<DoctorQueueView />);
    expect(screen.getByText('Session closed for today')).toBeOnTheScreen();
    expect(screen.getByLabelText('Seen: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Cancelled: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Not seen: 1')).toBeOnTheScreen();
    expect(screen.queryByText('Call next')).toBeNull();
  });

  it('shows the error state with retry when nothing is loaded', async () => {
    mockSnapshot = undefined;
    mockQueryError = true;
    await render(<DoctorQueueView />);
    await press('Try again');
    expect(mockRefetch).toHaveBeenCalled();
  });
});

describe('DoctorQueueView — current patient card', () => {
  it('called: Start primary, Recall / Undo call / Skip, patient file; no Call next', async () => {
    mockSnapshot = snapshot('open', [entry('c1', 'called'), entry('w1', 'waiting')]);
    await render(<DoctorQueueView />);
    expect(screen.queryByText('Call next')).toBeNull();
    for (const label of ['Start', 'Recall', 'Undo call', 'Skip', 'Patient file']) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

    await press('Start');
    expect(mockActions.startConsultation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', version: 4 }),
    );
    await press('Recall');
    await press('Undo call');
    await press('Skip');
    expect(mockActions.recall).toHaveBeenCalled();
    expect(mockActions.undoCall).toHaveBeenCalled();
    expect(mockActions.skip).toHaveBeenCalled();
    await press('Patient file');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/patients/[patientId]',
      params: { patientId: 'p-c1' },
    });
  });

  it('in_consultation: Done primary, Send for test, Abort', async () => {
    mockSnapshot = snapshot('open', [entry('c1', 'in_consultation')]);
    await render(<DoctorQueueView />);
    for (const label of ['Done', 'Send for test', 'Abort']) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    await press('Done');
    expect(mockActions.complete).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });

  it('every button on the card is disabled while a mutation on that entry is pending', async () => {
    mockSnapshot = snapshot('open', [entry('c1', 'in_consultation')]);
    mockActions.busyEntryIds = new Set(['c1']);
    await render(<DoctorQueueView />);
    for (const label of ['Done', 'Send for test', 'Abort', 'Patient file']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
  });

  it('a waiting row is locked while a mutation on it is pending', async () => {
    mockPerms = ['queue.doctor.own'];
    mockActions.busyEntryIds = new Set(['w1']);
    await render(<DoctorQueueView />);
    expect(screen.getByRole('button', { name: 'Actions for A-W1' })).toBeDisabled();
    // (the row's own Pressable is inert, so check the button's state, not its ancestors)
    expect(
      screen.getByRole('button', { name: 'Actions for A-W2' }).props.accessibilityState,
    ).toMatchObject({ disabled: false });
  });
});

describe('DoctorQueueView — reason sheet', () => {
  it('Pause needs a reason: submit disabled when empty, error shown, sends the trimmed text', async () => {
    await render(<DoctorQueueView />);
    await press('Session actions');
    await press('menu: Pause session');
    expect(screen.getByText('Pause session')).toBeOnTheScreen();

    const field = screen.getByLabelText('Reason');
    await fireEvent(field, 'focus');
    await fireEvent.changeText(field, '   ');
    await waitFor(() => expect(screen.getByText('Enter a reason')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'submit Pause' })).toBeDisabled();

    await fireEvent.changeText(field, '  Lunch break ');
    await waitFor(() => expect(screen.getByRole('button', { name: 'submit Pause' })).toBeEnabled());
    await press('submit Pause');
    await waitFor(() => expect(mockActions.pauseSession).toHaveBeenCalledWith('s1', 'Lunch break'));
  });

  it('Send for test accepts an empty reason (undefined)', async () => {
    mockSnapshot = snapshot('open', [entry('c1', 'in_consultation')]);
    await render(<DoctorQueueView />);
    await press('Send for test');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'submit Send for test' })).toBeEnabled(),
    );
    await press('submit Send for test');
    await waitFor(() =>
      expect(mockActions.sendForTest).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1' }),
        undefined,
      ),
    );
  });

  it('Abort asks first and sends the reason', async () => {
    mockSnapshot = snapshot('open', [entry('c1', 'in_consultation')]);
    await render(<DoctorQueueView />);
    await press('Abort');
    expect(screen.getAllByText('Abort consultation')).toHaveLength(2); // title + submit
    expect(mockActions.abort).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Reason'), 'Patient left');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'submit Abort consultation' })).toBeEnabled(),
    );
    await press('submit Abort consultation');
    await waitFor(() =>
      expect(mockActions.abort).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'c1' }),
        'Patient left',
      ),
    );
  });

  it('rejects a reason over 500 characters', async () => {
    await render(<DoctorQueueView />);
    await press('Session actions');
    await press('menu: Pause session');
    await fireEvent.changeText(screen.getByLabelText('Reason'), 'x'.repeat(501));
    await waitFor(() => expect(screen.getByText('Keep it under 500 characters')).toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'submit Pause' })).toBeDisabled();
  });

  it('calling the suggested patient goes straight through; jumping the order asks for a reason', async () => {
    mockSnapshot = snapshot('open', [entry('w1', 'waiting'), entry('w2', 'waiting')], {
      suggestion: { entryId: 'w1', reason: 'FIFO' },
    });
    await render(<DoctorQueueView />);

    await press('Actions for A-W1');
    await press('menu: Call this patient');
    expect(mockActions.select).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'w1' }),
      undefined,
    );

    mockActions.select.mockClear();
    await press('Actions for A-W2');
    await press('menu: Call this patient');
    expect(mockActions.select).not.toHaveBeenCalled();
    expect(screen.getByText('Call out of order')).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'submit Call patient' })).toBeEnabled(),
    );
    await fireEvent.changeText(screen.getByLabelText('Reason'), 'Urgent for family');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'submit Call patient' })).toBeEnabled(),
    );
    await press('submit Call patient');
    await waitFor(() =>
      expect(mockActions.select).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w2', version: 4 }),
        'Urgent for family',
      ),
    );
  });
});
