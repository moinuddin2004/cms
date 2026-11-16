import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useDoseQueueStore } from '@/patient/features/medications';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { TodayPage } from './TodayPage';

jest.mock('@shopify/flash-list', () => {
  const { FlatList } = jest.requireActual<typeof import('react-native')>('react-native');
  return { FlashList: (props: { data: never[] }) => <FlatList {...(props as object)} data={props.data} /> };
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => true,
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    cancelAnimation: () => {},
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return { BottomSheetTextInput: (props: object) => <RN.TextInput {...props} /> };
});
jest.mock('@/core/components/overlays/sheet-parts', () => ({
  SheetBackground: () => null,
  SheetHandle: () => null,
  useSheetBackdrop: () => undefined,
  useControlledSheet: () => ({ ref: { current: null }, onDismiss: () => {} }),
}));
jest.mock('@/core/components/overlays/FormSheet', () => ({ FormSheet: () => null }));
jest.mock('@/core/components/overlays/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/core/components/overlays/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockMeds = jest.fn();
const mockEvents = jest.fn();
const mockPost = jest.fn();
jest.mock('@/patient/features/medications/api/medications.api', () => ({
  fetchAllMedications: (...a: unknown[]) => mockMeds(...a),
  fetchDoseEvents: (...a: unknown[]) => mockEvents(...a),
  postDoseEvents: (...a: unknown[]) => mockPost(...a),
}));
// The records barrel pulls every records screen; Today only needs the cached upcoming appointments.
const mockAppts = jest.fn();
jest.mock('@/patient/features/records', () => ({
  useRecordUpcomingAppointments: () => ({ data: mockAppts(), refetch: jest.fn() }),
}));

const schedule = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  profileId: 'p1',
  source: 'prescription',
  clinic: null,
  prescriptionId: 'rx',
  prescriptionMedicineId: 'm',
  name: 'Amoxicillin',
  nameUrdu: null,
  doseText: '500 mg',
  mealRelation: 'AFTER_MEAL',
  times: ['08:00', '20:00'],
  startDate: '2020-01-01',
  endDate: null,
  endDateSource: 'unknown',
  status: 'active',
  instructions: null,
  instructionsUrdu: null,
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

async function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockEvents.mockResolvedValue([]);
  mockAppts.mockReturnValue([]);
  usePatientAuthStore.setState({ account: { id: 'acc-1', fullName: 'A', email: 'a@x.com' } });
  useDoseQueueStore.getState().reset();
  await useDoseQueueStore.getState().hydrate('acc-1');
  useDoseQueueStore.getState().remove(useDoseQueueStore.getState().items); // the mocked encrypted cache outlives a test
});

describe('TodayPage', () => {
  it('shows a skeleton, then the day grouped with the medicine and dose', async () => {
    mockMeds.mockResolvedValue([schedule()]);
    await wrap(<TodayPage />);
    expect(await screen.findByText('Morning')).toBeTruthy();
    expect(screen.getByText('Evening')).toBeTruthy();
    expect(screen.getAllByText('Amoxicillin')).toHaveLength(2);
    expect(screen.getAllByText('500 mg · After meal').length).toBe(2);
  });

  it('Taken is saved locally first and sent; the row turns to Taken', async () => {
    mockMeds.mockResolvedValue([schedule({ times: ['08:00'] })]);
    mockPost.mockResolvedValue(1);
    await wrap(<TodayPage />);
    fireEvent.press(await screen.findByLabelText('Mark Amoxicillin as taken'));
    await waitFor(() => expect(screen.getByText('Taken')).toBeTruthy());
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost.mock.calls[0][0][0]).toMatchObject({ scheduleId: 's1', action: 'taken' });
  });

  it('offline: the decision stays on the phone and says it will sync', async () => {
    mockMeds.mockResolvedValue([schedule({ times: ['08:00'] })]);
    mockPost.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    await wrap(<TodayPage />);
    fireEvent.press(await screen.findByLabelText('Mark Amoxicillin as taken'));
    expect(await screen.findByText('Will sync when you are back online')).toBeTruthy();
    expect(screen.getByText('1 change waiting to sync')).toBeTruthy();
    await act(async () => undefined);
    expect(useDoseQueueStore.getState().items).toHaveLength(1);
  });

  it('a dose that was already taken on the server shows as taken', async () => {
    const due = new Date();
    due.setHours(8, 0, 0, 0);
    mockMeds.mockResolvedValue([schedule({ times: ['08:00'] })]);
    mockEvents.mockResolvedValue([
      { scheduleId: 's1', dueAt: due.toISOString(), action: 'taken', actedAt: due.toISOString() },
    ]);
    await wrap(<TodayPage />);
    expect(await screen.findByText('Taken')).toBeTruthy();
    expect(screen.queryByLabelText('Mark Amoxicillin as taken')).toBeNull();
  });

  it('nothing linked yet: invites to link a clinic', async () => {
    mockMeds.mockResolvedValue([]);
    await wrap(<TodayPage />);
    expect(await screen.findByText('Link your first clinic')).toBeTruthy();
  });

  it('medicines but nothing due today', async () => {
    mockMeds.mockResolvedValue([schedule({ status: 'paused' })]);
    await wrap(<TodayPage />);
    expect(await screen.findByText('Nothing due today.')).toBeTruthy();
  });

  it('error with retry when nothing is cached', async () => {
    mockMeds.mockRejectedValueOnce(new Error('boom'));
    await wrap(<TodayPage />);
    expect(await screen.findByText("We couldn't load today")).toBeTruthy();
    mockMeds.mockResolvedValue([schedule()]);
    fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Morning')).toBeTruthy();
  });

  it('says so when the dose status cannot be loaded, instead of silently showing everything as pending', async () => {
    mockMeds.mockResolvedValue([schedule({ times: ['08:00'] })]);
    mockEvents.mockRejectedValue(new Error('offline'));
    await wrap(<TodayPage />);
    expect(await screen.findByText("Couldn't load dose status — tap to retry")).toBeTruthy();
    mockEvents.mockResolvedValue([]);
    fireEvent.press(screen.getByLabelText("Couldn't load dose status — tap to retry"));
    await waitFor(() => expect(screen.queryByText("Couldn't load dose status — tap to retry")).toBeNull());
  });

  it('the row is not one accessible block: the buttons can be reached, the summary is its own element', async () => {
    mockMeds.mockResolvedValue([schedule({ times: ['08:00'] })]);
    await wrap(<TodayPage />);
    const summary = await screen.findByLabelText('08:00, Amoxicillin, 500 mg · After meal');
    expect(within(summary).queryByLabelText('Mark Amoxicillin as taken')).toBeNull();
    expect(screen.getByLabelText('Mark Amoxicillin as taken')).toBeTruthy();
  });

  it('after Taken is sent, the row stays Taken even though the server list is still stale', async () => {
    mockMeds.mockResolvedValue([schedule({ times: ['08:00'] })]);
    mockPost.mockResolvedValue(1);
    await wrap(<TodayPage />);
    fireEvent.press(await screen.findByLabelText('Mark Amoxicillin as taken'));
    await waitFor(() => expect(useDoseQueueStore.getState().items).toHaveLength(0));
    expect(screen.queryByLabelText('Mark Amoxicillin as taken')).toBeNull();
    expect(screen.getByText('Taken')).toBeTruthy();
  });
});
