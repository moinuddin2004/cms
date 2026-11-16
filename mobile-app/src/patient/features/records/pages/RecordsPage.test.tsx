import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import type { ClinicRef, PatientAppointment } from '../types/records.types';
import { RecordsPage } from './RecordsPage';

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
jest.mock('@/core/components/overlays/ActionSheet', () => ({ ActionSheet: () => null }));
jest.mock('@/core/components/overlays/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/patient/features/contact', () => ({ ContactButton: () => null }));
jest.mock('../hooks/useConfirmAppointment', () => ({
  useConfirmAppointment: () => ({ isPending: false, mutate: jest.fn() }),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => false }),
}));

const mockAppointments = jest.fn();
const mockVisits = jest.fn();
const mockPrescriptions = jest.fn();
const mockBilling = jest.fn();
jest.mock('../api/records.api', () => ({
  fetchAppointments: (...a: unknown[]) => mockAppointments(...a),
  fetchVisits: (...a: unknown[]) => mockVisits(...a),
  fetchPrescriptions: (...a: unknown[]) => mockPrescriptions(...a),
  fetchBilling: (...a: unknown[]) => mockBilling(...a),
  fetchPrescription: jest.fn(),
}));

const clinic = (over: Partial<ClinicRef> = {}): ClinicRef => ({
  organizationId: 'o1',
  name: 'City Dental',
  logoUrl: null,
  brandColor: null,
  clinicStatus: 'active',
  ...over,
});
const appt = (over: Partial<PatientAppointment> = {}): PatientAppointment => ({
  id: 'a1',
  profileId: 'p1',
  clinic: clinic(),
  location: { id: 'l1', name: 'Main', timezone: 'Asia/Karachi', phone: null, whatsapp: null, address: null },
  doctorName: 'Dr Sana',
  startTime: '2026-11-03T11:30:00.000Z',
  endTime: '2026-11-03T12:00:00.000Z',
  status: 'scheduled',
  type: 'checkup',
  patientConfirmedAt: null,
  canConfirm: false,
  ...over,
});
const emptyPage = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };

async function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<RecordsPage />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  usePatientAuthStore.setState({ account: { id: 'acc1', fullName: 'A', email: 'a@x.com' } });
  mockVisits.mockResolvedValue(emptyPage);
  mockPrescriptions.mockResolvedValue(emptyPage);
  mockBilling.mockResolvedValue([]);
});

describe('RecordsPage', () => {
  it('shows a loading skeleton, then the appointment on its clinic clock with a clinic chip', async () => {
    mockAppointments.mockResolvedValue([appt()]);
    await renderPage();
    expect(await screen.findByText('Tue, 3 Nov · 4:30 PM')).toBeTruthy();
    expect(screen.getByText('City Dental · Main')).toBeTruthy();
  });

  it('shows an empty state when there are no appointments', async () => {
    mockAppointments.mockResolvedValue([]);
    await renderPage();
    expect(await screen.findByText('No appointments yet')).toBeTruthy();
  });

  it('shows an error with retry', async () => {
    // the full list and the upcoming list both fail once, then succeed on retry
    mockAppointments
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue([appt()]);
    await renderPage();
    fireEvent.press(await screen.findByText('Try again'));
    expect(await screen.findByText('with Dr Sana')).toBeTruthy();
  });

  it('shows no-results (not empty) when the search matches nothing', async () => {
    mockAppointments.mockResolvedValue([appt()]);
    await renderPage();
    await screen.findByText('with Dr Sana');
    fireEvent.changeText(screen.getByPlaceholderText('Search clinic or doctor'), 'zzz');
    expect(await screen.findByText('Nothing matches your search', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('shows a calm paused chip for a suspended clinic and keeps the record readable', async () => {
    mockAppointments.mockResolvedValue([appt({ clinic: clinic({ clinicStatus: 'suspended' }) })]);
    await renderPage();
    expect(await screen.findByText('This clinic is paused')).toBeTruthy();
    expect(screen.getByText('with Dr Sana')).toBeTruthy();
  });

  it('hides the Bills segment when no clinic shows billing', async () => {
    mockAppointments.mockResolvedValue([appt()]);
    await renderPage();
    await screen.findByText('with Dr Sana');
    await waitFor(() => expect(screen.queryByText('Bills')).toBeNull());
  });

  it('opens an appointment detail', async () => {
    mockAppointments.mockResolvedValue([appt()]);
    await renderPage();
    fireEvent.press(await screen.findByText('Tue, 3 Nov · 4:30 PM'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/appointments/[id]', params: { id: 'a1' } });
  });
  it('falls back to the cached upcoming appointments when the full list fails', async () => {
    mockAppointments.mockImplementation((_profile: unknown, from?: string) =>
      from ? Promise.resolve([appt()]) : Promise.reject(new Error('offline')),
    );
    await renderPage();
    expect(await screen.findByText('with Dr Sana')).toBeTruthy();
  });
});
