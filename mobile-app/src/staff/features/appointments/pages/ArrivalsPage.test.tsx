import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AppointmentListItem } from '../types/appointments.types';
import { ArrivalsPage } from './ArrivalsPage';

const mockStart = jest.fn();
const mockConvert = jest.fn();
let mockArrivals: Record<string, unknown> = {};
let mockLate = false;

jest.mock('../hooks/useAppointments', () => ({ useArrivals: () => mockArrivals }));
jest.mock('../hooks/useCheckInFlow', () => ({
  useCheckInFlow: () => ({
    start: mockStart,
    checkingIn: false,
    lateOpen: mockLate,
    dismissLate: jest.fn(),
    convert: mockConvert,
  }),
}));
jest.mock('@/staff/features/queue', () => ({
  UrgentReasonSheet: ({ open, onSubmit }: { open: boolean; onSubmit: (r: string) => Promise<unknown> }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return open ? (
      <Pressable accessibilityLabel="Submit urgent" onPress={() => void onSubmit('chest pain')}>
        <Text>urgent sheet</Text>
      </Pressable>
    ) : null;
  },
}));
jest.mock('@/staff/lib/clinic-today', () => ({ useClinicToday: () => '2026-11-15' }));
jest.mock('@/core/http', () => ({ useCanMutate: () => true }));
jest.mock('@/core/http/use-can-mutate', () => ({ useCanMutate: () => true }));
jest.mock('@/staff/lib/datetime', () => ({
  formatInClinic: () => '10:00',
  formatTime: () => '10:00 AM',
}));
jest.mock('../components/LateWalkInDialog', () => ({
  LateWalkInDialog: ({ open }: { open: boolean }) => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return open ? <Text>Too late for this appointment</Text> : null;
  },
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BottomSheetTextInput: TextInput };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => true, back: jest.fn() }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const hooks: Record<string, unknown> = {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
  };
  return new Proxy(hooks, { get: (t, k: string) => (k in t ? t[k] : (f: unknown) => f) });
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual<typeof import('react-native')>('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ data, renderItem }: { data: unknown[]; renderItem: (a: { item: unknown }) => React.ReactNode }) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return <View>{data.map((item, i) => <View key={i}>{renderItem({ item })}</View>)}</View>;
  },
}));

const row = (id: string) =>
  ({
    id,
    status: 'scheduled',
    type: 'checkup',
    startTime: '2026-11-15T05:00:00.000Z',
    patient: { id: `p${id}`, fullName: `Patient ${id}` },
    doctor: { id: 'd1', fullName: 'Dr Ayesha' },
    queueEntry: null,
  }) as unknown as AppointmentListItem;

const ok = (rows: AppointmentListItem[]) => ({
  isPending: false,
  isError: false,
  isRefetching: false,
  dataUpdatedAt: 0,
  refetch: jest.fn(),
  data: rows,
});

describe('ArrivalsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLate = false;
    mockArrivals = ok([row('a1')]);
  });

  it('check in sends the booking id with no urgent reason', async () => {
    await render(<ArrivalsPage />);
    await fireEvent.press(screen.getByLabelText('Check in'));
    expect(mockStart).toHaveBeenCalledWith('a1', undefined);
  });

  it('the urgent variant asks for a reason first', async () => {
    await render(<ArrivalsPage />);
    await fireEvent.press(screen.getByLabelText('Check in Patient a1 as urgent'));
    await fireEvent.press(screen.getByLabelText('Submit urgent'));
    expect(mockStart).toHaveBeenCalledWith('a1', 'chest pain');
  });

  it('empty state', async () => {
    mockArrivals = ok([]);
    await render(<ArrivalsPage />);
    expect(screen.getByText('No one left to check in')).toBeTruthy();
  });

  it('error state offers a retry', async () => {
    mockArrivals = { ...ok([]), isError: true };
    await render(<ArrivalsPage />);
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('a late booking shows the walk-in dialog', async () => {
    mockLate = true;
    await render(<ArrivalsPage />);
    expect(screen.getByText('Too late for this appointment')).toBeTruthy();
  });
});
