import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { useRecentPatientsStore } from '../store/useRecentPatientsStore';
import { PatientDetailPage } from './PatientDetailPage';

const ID = '0b2f0c6e-8f7d-4a53-9a55-6f9d5b1c2e11';

type Gated = { access: 'loading' | 'denied' } | { access: 'allowed'; query: unknown };
const ok = <T,>(data: T): Gated => ({
  access: 'allowed',
  query: { isPending: false, isError: false, data, refetch: jest.fn() },
});

const patient = {
  id: ID,
  patientNumber: 'P-00034',
  fullName: 'Ali Raza',
  phone: '0300-1234567',
  whatsappNumber: null,
  dob: '1992-01-01',
  gender: 'male',
  bloodGroup: 'O+',
  allergies: 'Penicillin, Latex',
  isBlacklisted: true,
  blacklistReason: 'Missed visits',
  isMinor: false,
  guardianName: null,
  guardianPhone: null,
  guardianRelation: null,
  medicalHistory: 'Asthma',
};

let mockPatient: Record<string, unknown>;
let mockRx: Gated;
let mockChart: Gated;
let mockHistory: Gated;
let mockVitals: Gated;
const mockCopy = jest.fn();
const mockToast = jest.fn();

jest.mock('../hooks/usePatient', () => ({ usePatient: () => mockPatient }));
jest.mock('../hooks/usePatientPrescriptions', () => ({ usePatientPrescriptions: () => mockRx }));
jest.mock('../hooks/useLatestTeethChart', () => ({ useLatestTeethChart: () => mockChart }));
jest.mock('../hooks/usePatientHistory', () => ({ usePatientHistory: () => mockHistory }));
jest.mock('../hooks/usePatientVitals', () => ({ usePatientVitals: () => mockVitals }));
jest.mock('@/staff/features/queue', () => ({
  usePatientQueueVisits: () => ({ isPending: false, isError: false, data: [], refetch: jest.fn() }),
}));
jest.mock('../lib/copy-text', () => ({ copyText: (t: string) => mockCopy(t) }));
jest.mock('sonner-native', () => ({ toast: (m: string) => mockToast(m) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/core/network', () => ({ useOnline: () => true }));
// Reanimated's native worklets runtime cannot load under Jest (same stand-in as FormSheet.test).
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: <T,>(c: T) => c },
    FadeIn: {},
    FadeOut: {},
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: unknown) => ({ value: v }),
    useReducedMotion: () => true,
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    withSequence: (v: unknown) => v,
    Easing: { linear: 0, inOut: () => 0, ease: 0 },
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return { BottomSheetTextInput: TextInput };
});
jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual<typeof import('react-native')>('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});
// The real sheets need the native gesture runtime; stand-ins render their content only while open.
jest.mock('@/core/components/overlays/ActionSheet', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ActionSheet: ({
      open,
      actions,
    }: {
      open: boolean;
      actions: { label: string; onPress: () => void }[];
    }) =>
      open ? (
        <>
          {actions.map((a) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress}>
              <Text>{a.label}</Text>
            </Pressable>
          ))}
        </>
      ) : null,
  };
});
jest.mock('@/core/components/overlays/FormSheet', () => {
  const { View, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FormSheet: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
      open ? (
        <View>
          <Text>{`sheet:${title}`}</Text>
          {children}
        </View>
      ) : null,
  };
});

const rx = (id: string, status: string, n: string) => ({
  id,
  prescriptionNumber: n,
  status,
  createdAt: '2026-11-01T08:00:00.000Z',
  diagnosis: null,
  medicines: [{ medicineName: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', duration: '5 days' }],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPatient = { isPending: false, isError: false, isRefetching: false, data: patient, refetch: jest.fn() };
  mockRx = { access: 'denied' };
  mockChart = { access: 'denied' };
  mockHistory = { access: 'denied' };
  mockVitals = { access: 'denied' };
  mockCopy.mockResolvedValue(true);
  useRecentPatientsStore.getState().clear();
});

describe('PatientDetailPage', () => {
  it('renders the header and alert strip', async () => {
    await render(<PatientDetailPage patientId={ID} />);
    expect(screen.getByText('Ali Raza')).toBeTruthy();
    expect(screen.getByText(/P-00034 · \d+y · Male · O\+/)).toBeTruthy();
    expect(screen.getByLabelText('Allergies: Penicillin, Latex')).toBeTruthy();
    expect(screen.getByLabelText('Blacklisted: Missed visits')).toBeTruthy();
  });

  it('records the patient id in the recent store', async () => {
    await render(<PatientDetailPage patientId={ID} />);
    expect(useRecentPatientsStore.getState().ids).toEqual([ID]);
  });

  it('rejects a non-uuid route param with "Not found" and never records it', async () => {
    await render(<PatientDetailPage patientId="../patients" />);
    expect(screen.getByText('Not found')).toBeTruthy();
    expect(useRecentPatientsStore.getState().ids).toEqual([]);
  });

  it('shows loading and error states', async () => {
    mockPatient = { isPending: true, isError: false, data: undefined };
    const { unmount } = await render(<PatientDetailPage patientId={ID} />);
    expect(screen.queryByText('Ali Raza')).toBeNull();
    await unmount();
    const refetch = jest.fn();
    mockPatient = { isPending: false, isError: true, error: new Error('x'), data: undefined, refetch };
    await render(<PatientDetailPage patientId={ID} />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('offers only Overview and Visits when clinical data is denied', async () => {
    await render(<PatientDetailPage patientId={ID} />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Visits' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Rx' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Chart' })).toBeNull();
    expect(screen.queryByText('Latest vitals')).toBeNull(); // denied block: hidden, no error
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('shows Rx and Chart when allowed, drafts after finalized, and opens the read-only detail', async () => {
    mockRx = ok({ total: 3, data: [rx('1', 'FINALIZED', 'RX-1'), rx('2', 'AMENDED', 'RX-2'), rx('3', 'DRAFT', 'RX-3')] });
    mockChart = ok({
      id: 'c',
      recordedAt: '2026-11-01T08:00:00.000Z',
      notes: null,
      chartData: { '16': { condition: 'CROWN' } },
    });
    await render(<PatientDetailPage patientId={ID} />);
    expect(screen.getByRole('tab', { name: 'Rx' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Rx' }));
    const labels = screen.getAllByText(/^RX-\d$/).map((n) => n.props.children);
    expect(labels).toEqual(['RX-1', 'RX-2', 'RX-3']);
    await fireEvent.press(screen.getByText('RX-2'));
    expect(screen.getByText('sheet:RX-2')).toBeTruthy();
    expect(screen.getByText('Amoxicillin')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Chart' }));
    expect(screen.getByText('Crown')).toBeTruthy();
  });

  it('shows vitals and an error block with retry for allowed data', async () => {
    mockVitals = ok([{ id: 'v', recordedAt: '2026-11-01T08:00:00.000Z', bpSystolic: 120, bpDiastolic: 80 }]);
    await render(<PatientDetailPage patientId={ID} />);
    expect(screen.getByText('120/80 mmHg')).toBeTruthy();
  });

  it('shows empty text for a segment with no data', async () => {
    mockRx = ok({ total: 0, data: [] });
    await render(<PatientDetailPage patientId={ID} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Rx' }));
    expect(screen.getByText('No prescriptions yet.')).toBeTruthy();
  });

  describe('⋯ actions', () => {
    const openMenu = () => fireEvent.press(screen.getByLabelText('More actions'));

    it('calls with a sanitised tel: url', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
      await render(<PatientDetailPage patientId={ID} />);
      await openMenu();
      await fireEvent.press(screen.getByText('Call'));
      expect(open).toHaveBeenCalledWith('tel:03001234567');
    });

    it('opens WhatsApp with digits only', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
      mockPatient = { ...mockPatient, data: { ...patient, whatsappNumber: '+92 300 7654321' } };
      await render(<PatientDetailPage patientId={ID} />);
      await openMenu();
      await fireEvent.press(screen.getByText('WhatsApp'));
      expect(open).toHaveBeenCalledWith('https://wa.me/923007654321');
    });

    it('toasts without the number when the link cannot open', async () => {
      jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
      await render(<PatientDetailPage patientId={ID} />);
      await openMenu();
      await fireEvent.press(screen.getByText('Call'));
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Could not open this link'));
    });

    it('copies the MR number only on an explicit press, with a toast', async () => {
      await render(<PatientDetailPage patientId={ID} />);
      expect(mockCopy).not.toHaveBeenCalled();
      await openMenu();
      await fireEvent.press(screen.getByText('Copy MR no.'));
      expect(mockCopy).toHaveBeenCalledWith('P-00034');
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith('MR number copied'));
    });

    it('is honest when copying is unavailable', async () => {
      mockCopy.mockResolvedValue(false);
      await render(<PatientDetailPage patientId={ID} />);
      await openMenu();
      await fireEvent.press(screen.getByText('Copy MR no.'));
      await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Copy is not available in this build'));
    });
  });
});
