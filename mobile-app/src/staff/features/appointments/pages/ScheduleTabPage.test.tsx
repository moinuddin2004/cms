import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { appointmentKeys } from '../api/appointments.keys';
import type { AppointmentListItem } from '../types/appointments.types';

import { ScheduleTabPage } from './ScheduleTabPage';

const mockDay = jest.fn();
const mockDoctors = jest.fn();
const mockCheckIn = jest.fn();
const mockConvert = jest.fn();
const mockToast = { success: jest.fn(), error: jest.fn() };
let mockCan: (perm: string) => boolean = () => true;
let mockOnline = true;

jest.mock('../hooks/useAppointments', () => ({
  useDayAppointments: (...args: unknown[]) => mockDay(...args),
  useDoctors: () => mockDoctors(),
  useAppointment: () => ({ data: undefined }),
}));
jest.mock('@/staff/features/queue', () => {
  const errors = jest.requireActual<typeof import('@/staff/features/queue/lib/queue-errors')>(
    '@/staff/features/queue/lib/queue-errors',
  );
  return {
    isDialogError: errors.isDialogError,
    queueErrorCode: errors.queueErrorCode,
    queueErrorMessage: errors.queueErrorMessage,
    shouldRefetch: errors.shouldRefetch,
    useCheckIn: () => ({ mutate: mockCheckIn, isPending: false }),
    useConvertToWalkIn: () => ({ mutateAsync: mockConvert, isPending: false }),
  };
});
jest.mock('@/staff/features/access', () => ({ useAccess: () => ({ can: (p: string) => mockCan(p) }) }));
jest.mock('@/staff/features/notifications', () => ({ NotificationBell: () => null }));
jest.mock('@/staff/lib/clinic-today', () => ({ useClinicToday: () => '2026-11-15' }));
jest.mock('@/core/http', () => ({ useCanMutate: () => mockOnline }));
jest.mock('sonner-native', () => ({
  toast: {
    success: (...a: unknown[]) => mockToast.success(...a),
    error: (...a: unknown[]) => mockToast.error(...a),
  },
}));
// The phone runs on another zone: everything below must read the CLINIC's clock (Karachi, UTC+5).
jest.mock('@/staff/lib/datetime', () => {
  const core = jest.requireActual<typeof import('@/core/datetime')>('@/core/datetime');
  const zone = 'Asia/Karachi';
  return {
    useClinicTimezone: () => zone,
    formatYmd: core.formatYmd,
    formatInClinic: (v: string | number, p: string) => core.formatInZone(v, zone, p),
    formatTime: (v: string) => core.formatInZone(v, zone, 'h:mm a'),
    formatDate: (v: string) => core.formatInZone(v, zone, 'MMM d, yyyy'),
  };
});

// Native-only pieces: stand-ins that render their content.
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => false }) }));
jest.mock('@gorhom/bottom-sheet', () => {
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BottomSheetTextInput: TextInput };
});
// Reanimated's native runtime is not loadable in Jest: static stand-ins for the hooks the core kit uses.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const hooks: Record<string, unknown> = {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
  };
  return new Proxy(hooks, {
    get: (target, key: string) => key in target ? target[key] : (first: unknown) => first,
  });
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual<typeof import('react-native')>('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
  }: {
    data: unknown[];
    renderItem: (a: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
  }) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <View>
        {ListHeaderComponent}
        {data.map((item, index) => (
          <View key={index}>{renderItem({ item, index })}</View>
        ))}
        {ListFooterComponent}
      </View>
    );
  },
}));
jest.mock('@/core/components/overlays/FormSheet', () => ({
  FormSheet: ({
    open,
    title,
    children,
    submit,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
    submit?: { label: string; onPress: () => void; disabled?: boolean };
  }) => {
    const { View, Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    if (!open) return null;
    return (
      <View>
        <Text>{title}</Text>
        {children}
        {submit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={submit.label}
            accessibilityState={{ disabled: !!submit.disabled }}
            disabled={submit.disabled}
            onPress={submit.onPress}>
            <Text>{submit.label}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
}));
jest.mock('@/core/components/overlays/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }) => {
    const { View, Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
    if (!open) return null;
    return (
      <View>
        <Text>{title}</Text>
        <Text>{description}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} onPress={() => void onConfirm().catch(() => {})}>
          <Text>{confirmLabel}</Text>
        </Pressable>
      </View>
    );
  },
}));

const item = (id: string, over: Partial<AppointmentListItem> = {}) =>
  ({
    id,
    status: 'scheduled',
    type: 'checkup',
    // 10:00 AM in Karachi (05:00 UTC).
    startTime: '2026-11-15T05:00:00.000Z',
    endTime: '2026-11-15T05:30:00.000Z',
    reasonForVisit: null,
    queueEntry: null,
    patient: { id: `p-${id}`, fullName: `Patient ${id}`, phone: '', patientNumber: 'P-001' },
    doctor: { id: 'd1', fullName: 'Dr Ayesha' },
    ...over,
  }) as AppointmentListItem;

const result = (rows: AppointmentListItem[], over: Record<string, unknown> = {}) => ({
  isPending: false,
  isError: false,
  isRefetching: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  dataUpdatedAt: 0,
  refetch: jest.fn(),
  fetchNextPage: jest.fn(),
  data: { pages: [{ data: rows, total: rows.length, page: 1, limit: 50 }] },
  ...over,
});

let client: QueryClient;
async function renderPage() {
  client = new QueryClient();
  jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <ScheduleTabPage />
    </QueryClientProvider>,
  );
}

const lateError = { response: { data: { error: { code: 'LATE_LIMIT_EXCEEDED' } } } };

describe('ScheduleTabPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCan = () => true;
    mockOnline = true;
    mockDay.mockReturnValue(result([item('a1')]));
    mockDoctors.mockReturnValue({ data: [{ id: 'd1', fullName: 'Dr Ayesha' }] });
  });
  afterEach(() => client?.clear());

  it('shows the day on the clinic clock: strip, hour header and row time', async () => {
    await renderPage();
    // Yesterday … +6 → 8 days around Sunday Nov 15.
    expect(screen.getByLabelText('Saturday, Nov 14')).toBeTruthy();
    expect(screen.getByLabelText('Sunday, Nov 15, today')).toBeTruthy();
    expect(screen.getByLabelText('Saturday, Nov 21')).toBeTruthy();
    expect(mockDay).toHaveBeenLastCalledWith('2026-11-15', { doctorId: undefined, status: undefined });
    // 05:00 UTC is 10:00 on the clinic's clock, never the UTC / phone reading.
    expect(screen.getByLabelText('10 AM, 1 appointment')).toBeTruthy();
    expect(screen.getByText('10:00 AM')).toBeTruthy();
    expect(screen.queryByText('5:00 AM')).toBeNull();
    expect(screen.getByText('Patient a1')).toBeTruthy();
    expect(screen.getByText('Dr Ayesha · Check-up')).toBeTruthy();
    expect(screen.getByLabelText('Scheduled')).toBeTruthy();
  });

  it('shows the queue token on a row', async () => {
    mockDay.mockReturnValue(
      result([
        item('a1', {
          status: 'checked_in',
          queueEntry: { id: 'e1', token: 'A-007', status: 'waiting', sessionId: 's1' },
        }),
      ]),
    );
    await renderPage();
    expect(screen.getByLabelText('Token A-007')).toBeTruthy();
    expect(screen.getByLabelText('10:00 AM, Patient a1, Dr Ayesha · Check-up, Checked in, token A-007')).toBeTruthy();
  });

  it('keeps the doctor and status filters when the day changes', async () => {
    await renderPage();
    await fireEvent.press(screen.getByText('Dr Ayesha'));
    await fireEvent.press(screen.getByText('Confirmed'));
    expect(mockDay).toHaveBeenLastCalledWith('2026-11-15', { doctorId: 'd1', status: 'confirmed' });

    await fireEvent.press(screen.getByLabelText('Monday, Nov 16'));
    expect(mockDay).toHaveBeenLastCalledWith('2026-11-16', { doctorId: 'd1', status: 'confirmed' });

    await fireEvent.press(screen.getByLabelText('Sunday, Nov 15, today'));
    expect(mockDay).toHaveBeenLastCalledWith('2026-11-15', { doctorId: 'd1', status: 'confirmed' });
  });

  describe('list states', () => {
    it('loading shows no rows and no empty / error copy', async () => {
      mockDay.mockReturnValue(result([], { isPending: true, data: undefined }));
      await renderPage();
      expect(screen.queryByText('No appointments')).toBeNull();
      expect(screen.queryByText('Something went wrong')).toBeNull();
      expect(screen.queryByText('Patient a1')).toBeNull();
    });

    it('error offers a retry', async () => {
      const refetch = jest.fn();
      mockDay.mockReturnValue(result([], { isError: true, data: undefined, refetch }));
      await renderPage();
      expect(screen.getByText('Something went wrong')).toBeTruthy();
      await fireEvent.press(screen.getByText('Try again'));
      expect(refetch).toHaveBeenCalled();
    });

    it('empty day says so', async () => {
      mockDay.mockReturnValue(result([]));
      await renderPage();
      expect(screen.getByText('No appointments')).toBeTruthy();
      expect(screen.getByText('Nothing is booked for Sunday, Nov 15.')).toBeTruthy();
    });

    it('filtered-out day shows no-results with a clear button that resets both filters', async () => {
      mockDay.mockReturnValue(result([]));
      await renderPage();
      await fireEvent.press(screen.getByText('Cancelled'));
      expect(screen.getByText('No results for your filters')).toBeTruthy();
      expect(screen.queryByText('No appointments')).toBeNull();
      await fireEvent.press(screen.getByText('Clear all filters'));
      expect(mockDay).toHaveBeenLastCalledWith('2026-11-15', { doctorId: undefined, status: undefined });
      expect(screen.getByText('No appointments')).toBeTruthy();
    });

    it('a failed refresh keeps the rows and says so', async () => {
      mockDay.mockReturnValue(result([item('a1')], { isError: true }));
      await renderPage();
      expect(screen.getByText('Patient a1')).toBeTruthy();
      expect(screen.getByText('Could not refresh. Pull down to try again.')).toBeTruthy();
    });
  });

  describe('check-in button in the sheet', () => {
    const open = async (row = item('a1')) => {
      mockDay.mockReturnValue(result([row]));
      await renderPage();
      await fireEvent.press(screen.getByText('Patient a1'));
    };

    it('shows for a scheduled booking today with queue.checkin', async () => {
      await open();
      expect(screen.getByText('Appointment')).toBeTruthy();
      expect(screen.getByLabelText('Check in')).toBeTruthy();
    });

    it('shows for confirmed too', async () => {
      await open(item('a1', { status: 'confirmed' }));
      expect(screen.getByLabelText('Check in')).toBeTruthy();
    });

    it('is hidden without queue.checkin', async () => {
      mockCan = (p) => p !== 'queue.checkin';
      await open();
      expect(screen.getByText('Appointment')).toBeTruthy();
      expect(screen.queryByLabelText('Check in')).toBeNull();
    });

    it.each(['checked_in', 'completed', 'cancelled', 'no_show'] as const)('is hidden for %s', async (status) => {
      await open(item('a1', { status }));
      expect(screen.getByText('Appointment')).toBeTruthy();
      expect(screen.queryByLabelText('Check in')).toBeNull();
    });

    it('is hidden when a queue entry exists', async () => {
      await open(item('a1', { queueEntry: { id: 'e', token: 'A-001', status: 'waiting', sessionId: 's' } }));
      expect(screen.queryByLabelText('Check in')).toBeNull();
    });

    it('is hidden for a booking on another day, even with the permission', async () => {
      await open(item('a1', { startTime: '2026-11-16T05:00:00.000Z' }));
      expect(screen.queryByLabelText('Check in')).toBeNull();
    });

    it('is hidden for a walk-in row', async () => {
      await open(item('a1', { kind: 'walk_in', type: 'walk_in' }));
      expect(screen.queryByLabelText('Check in')).toBeNull();
    });

    it('reads "Offline" and is disabled without a connection', async () => {
      mockOnline = false;
      await open();
      const btn = screen.getByLabelText('Offline');
      expect(btn.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
      expect(screen.queryByLabelText('Check in')).toBeNull();
    });

    it('checks in, refreshes appointments, toasts the token and closes the sheet', async () => {
      mockCheckIn.mockImplementation((_vars, opts) => opts.onSuccess({ token: 'A-012' }));
      await open();
      await fireEvent.press(screen.getByLabelText('Check in'));
      expect(mockCheckIn).toHaveBeenCalledWith({ appointmentId: 'a1' }, expect.any(Object));
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: appointmentKeys.all });
      expect(mockToast.success).toHaveBeenCalledWith('Patient checked in · Token A-012');
      expect(screen.queryByText('Appointment')).toBeNull();
    });
  });

  describe('too late → walk-in', () => {
    it('asks, converts, refreshes appointments and closes', async () => {
      mockCheckIn.mockImplementation((_vars, opts) => opts.onError(lateError));
      mockConvert.mockResolvedValue({ token: 'W-003' });
      await renderPage();
      await fireEvent.press(screen.getByText('Patient a1'));
      await fireEvent.press(screen.getByLabelText('Check in'));

      expect(screen.getByText('Too late for this appointment')).toBeTruthy();
      expect(client.invalidateQueries).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByLabelText('Add as walk-in'));
      expect(mockConvert).toHaveBeenCalledWith({ appointmentId: 'a1' });
      await waitFor(() => expect(mockToast.success).toHaveBeenCalled());
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: appointmentKeys.all });
      expect(mockToast.success).toHaveBeenCalledWith('Added as walk-in · Token W-003');
      expect(screen.queryByText('Too late for this appointment')).toBeNull();
      expect(screen.queryByText('Appointment')).toBeNull();
    });

    it('keeps the dialog open when the conversion fails', async () => {
      mockCheckIn.mockImplementation((_vars, opts) => opts.onError(lateError));
      mockConvert.mockRejectedValue(new Error('boom'));
      await renderPage();
      await fireEvent.press(screen.getByText('Patient a1'));
      await fireEvent.press(screen.getByLabelText('Check in'));
      await fireEvent.press(screen.getByLabelText('Add as walk-in'));
      await screen.findByText('Too late for this appointment');
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it('a different check-in error opens no dialog', async () => {
      mockCheckIn.mockImplementation((_vars, opts) =>
        opts.onError({ response: { data: { error: { code: 'ALREADY_CHECKED_IN' } } } }),
      );
      await renderPage();
      await fireEvent.press(screen.getByText('Patient a1'));
      await fireEvent.press(screen.getByLabelText('Check in'));
      expect(screen.queryByText('Too late for this appointment')).toBeNull();
      // The screen is out of date: appointments refetch.
      expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: appointmentKeys.all });
    });
  });
});
