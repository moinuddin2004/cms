import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { useRecentPatientsStore } from '../store/useRecentPatientsStore';
import type { PatientListItem } from '../types/patients.types';
import { PatientsPage } from './PatientsPage';

const mockListProps: { onEndReached?: () => void } = {};
// FlashList ships ESM and needs native layout; a FlatList stand-in keeps the same props.
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    FlashList: (props: { onEndReached?: () => void }) => {
      mockListProps.onEndReached = props.onEndReached;
      return <FlatList {...(props as object)} data={(props as { data: never[] }).data} />;
    },
  };
});

jest.mock('react-native-keyboard-controller', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { KeyboardAwareScrollView: ScrollView };
});

const mockFetchPatients = jest.fn();
const mockFetchPatient = jest.fn();
const mockCheckPhone = jest.fn();
const mockCreate = jest.fn();
jest.mock('../api/patients.api', () => ({
  fetchPatients: (...a: unknown[]) => mockFetchPatients(...a),
  fetchPatient: (...a: unknown[]) => mockFetchPatient(...a),
  checkPatientPhone: (...a: unknown[]) => mockCheckPhone(...a),
  createPatient: (...a: unknown[]) => mockCreate(...a),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => false }),
}));

let mockCan = (_: string) => true;
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({ can: (p: string) => mockCan(p) }),
}));
jest.mock('@/staff/features/notifications', () => ({ NotificationBell: () => null }));

const mockToastSuccess = jest.fn();
jest.mock('sonner-native', () => ({
  toast: { success: (...a: unknown[]) => mockToastSuccess(...a), error: jest.fn() },
}));

// The real sheet needs the native gesture runtime: render its content inline.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    BottomSheetModal: React.forwardRef(function MockModal(
      {
        children,
        footerComponent: Footer,
      }: { children?: ReactNode; footerComponent?: React.ComponentType },
      _ref,
    ) {
      return (
        <>
          {children}
          {Footer ? <Footer /> : null}
        </>
      );
    }),
    BottomSheetScrollView: Pass,
    BottomSheetView: Pass,
    BottomSheetFooter: Pass,
    BottomSheetBackdrop: Pass,
    BottomSheetTextInput: (props: object) => <RN.TextInput {...props} />,
  };
});
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => true,
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    cancelAnimation: () => {},
  };
});
jest.mock('@/core/components/overlays/sheet-parts', () => ({
  SheetBackground: () => null,
  SheetHandle: () => null,
  useSheetBackdrop: () => undefined,
  useControlledSheet: () => ({ ref: { current: null }, onDismiss: () => {} }),
}));
jest.mock('@/core/components/overlays/ConfirmDialog', () => ({ ConfirmDialog: () => null }));

const patient = (over: Partial<PatientListItem> = {}): PatientListItem =>
  ({
    id: 'p1',
    patientNumber: 'P-00001',
    fullName: 'Ali Raza',
    phone: '03001234567',
    dob: '1990-01-01',
    gender: 'male',
    profilePictureUrl: null,
    isMinor: false,
    isActive: true,
    ...over,
  }) as PatientListItem;

const page = (data: PatientListItem[], pageNo = 1, totalPages = 1) => ({
  data,
  total: data.length,
  page: pageNo,
  limit: 20,
  totalPages,
});

async function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<PatientsPage />, { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCan = () => true;
  useRecentPatientsStore.setState({ ids: [] });
  useStaffAuthStore.setState({ activeOrganizationId: 'o1', activeLocationId: 'l1' });
  mockFetchPatients.mockResolvedValue(page([patient()]));
  mockFetchPatient.mockResolvedValue(patient());
});

describe('PatientsPage list states', () => {
  it('shows no rows while loading', async () => {
    mockFetchPatients.mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(screen.queryByText('Ali Raza')).toBeNull();
    expect(mockFetchPatients).toHaveBeenCalled();
  });

  it('renders a row with masked phone and opens the patient on tap', async () => {
    await renderPage();
    const row = await screen.findByLabelText(/Ali Raza, P-00001 · 0300•••4567/);
    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/patients/[patientId]',
      params: { patientId: 'p1' },
    });
    expect(useRecentPatientsStore.getState().ids).toEqual(['p1']);
  });

  it('loads Active patients, newest first, 20 per page', async () => {
    await renderPage();
    await screen.findByText('Ali Raza');
    expect(mockFetchPatients).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true, sortBy: 'createdAt', limit: 20, page: 1 }),
    );
  });

  it('shows the empty state with a register action', async () => {
    mockFetchPatients.mockResolvedValue(page([]));
    await renderPage();
    expect(await screen.findByText('No patients yet')).toBeTruthy();
    expect(screen.getByText('Register the first patient to get started.')).toBeTruthy();
  });

  it('shows no-results (not empty) when a filter is on, and Clear resets', async () => {
    await renderPage();
    await screen.findByText('Ali Raza');
    mockFetchPatients.mockResolvedValue(page([]));
    await fireEvent.press(screen.getByText('Minors'));
    expect(await screen.findByText('No results for your filters')).toBeTruthy();
    expect(screen.queryByText('No patients yet')).toBeNull();
    mockFetchPatients.mockResolvedValue(page([patient()]));
    await fireEvent.press(screen.getByText('Clear all filters'));
    expect(await screen.findByText('Ali Raza')).toBeTruthy();
  });

  it('shows an error with retry', async () => {
    mockFetchPatients.mockRejectedValueOnce(new Error('boom'));
    await renderPage();
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Ali Raza')).toBeTruthy();
  });
});

describe('paging', () => {
  it('a failed next page shows a footer Retry that fetches only that page', async () => {
    mockFetchPatients
      .mockResolvedValueOnce(page([patient()], 1, 2))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page([patient({ id: 'p2', fullName: 'Sara Khan' })], 2, 2));
    await renderPage();
    await screen.findByText('Ali Raza');
    await act(async () => mockListProps.onEndReached?.());
    expect(await screen.findByText('Could not load more')).toBeTruthy();
    expect(screen.queryByText('Could not refresh')).toBeNull();
    expect(screen.getByText('Ali Raza')).toBeTruthy(); // rows stay
    await fireEvent.press(screen.getByText('Retry'));
    expect(await screen.findByText('Sara Khan')).toBeTruthy();
    expect(mockFetchPatients).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
});

describe('search', () => {
  beforeEach(() =>
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }),
  );
  afterEach(() => jest.useRealTimers());

  it('waits 300 ms and ignores a single character', async () => {
    await renderPage();
    await act(async () => {});
    const input = screen.getByLabelText('Name, phone or MR no.');
    mockFetchPatients.mockClear();

    await fireEvent.changeText(input, 'A');
    await act(async () => jest.advanceTimersByTime(300));
    expect(mockFetchPatients).not.toHaveBeenCalled(); // under 2 characters: same query as no search

    await fireEvent.changeText(input, 'Al');
    await act(async () => jest.advanceTimersByTime(299));
    expect(mockFetchPatients).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    await waitFor(() =>
      expect(mockFetchPatients).toHaveBeenCalledWith(expect.objectContaining({ search: 'Al' })),
    );
  });
});

describe('recently opened', () => {
  it('lists recent ids while the search is empty', async () => {
    useRecentPatientsStore.setState({ ids: ['p9'] });
    mockFetchPatient.mockResolvedValue(patient({ id: 'p9', fullName: 'Sara Khan' }));
    await renderPage();
    expect(await screen.findByText('Recently opened')).toBeTruthy();
    expect(await screen.findByText('Sara Khan')).toBeTruthy();
  });
});

describe('permission', () => {
  it('shows the register button with patients.create', async () => {
    await renderPage();
    expect(screen.getByLabelText('Register patient')).toBeTruthy();
  });

  it('hides it, the sheet and the empty-state action without patients.create', async () => {
    mockCan = (p) => p !== 'patients.create';
    mockFetchPatients.mockResolvedValue(page([]));
    await renderPage();
    await screen.findByText('No patients yet');
    expect(screen.queryByLabelText('Register patient')).toBeNull();
    expect(screen.queryByText('Register the first patient to get started.')).toBeNull();
    expect(screen.queryByText('Register patient')).toBeNull();
  });
});

describe('quick register', () => {
  const fill = async (name: string, phone: string) => {
    await fireEvent.changeText(screen.getByLabelText('Full name'), name);
    await fireEvent.changeText(screen.getByLabelText('Phone'), phone);
  };

  it('does not submit an invalid form', async () => {
    await renderPage();
    await screen.findByText('Ali Raza');
    await fireEvent.press(screen.getByLabelText('Register patient'));
    await fill('Sara', '12');
    await fireEvent(screen.getByLabelText('Phone'), 'blur');
    expect(await screen.findByText(/Enter a valid phone number/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Register'));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCheckPhone).not.toHaveBeenCalled(); // an invalid phone never hits the check
  });

  it('a minor needs guardian fields', async () => {
    await renderPage();
    await fireEvent.press(screen.getByLabelText('Register patient'));
    await fill('Sara', '03001234567');
    await fireEvent.press(screen.getByLabelText('Patient is a minor'));
    expect(await screen.findByLabelText('Guardian name')).toBeTruthy();
    // the form is invalid, so the submit button is disabled and pressing does nothing
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled();
    await fireEvent.press(screen.getByText('Register'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('checks the phone only on blur and offers Search when it exists', async () => {
    mockCheckPhone.mockResolvedValue({ exists: true });
    await renderPage();
    await fireEvent.press(screen.getByLabelText('Register patient'));
    await fireEvent.changeText(screen.getByLabelText('Phone'), '03001234567');
    expect(mockCheckPhone).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Phone'), 'blur');
    expect(await screen.findByText('A patient with this phone already exists')).toBeTruthy();
    expect(mockCheckPhone).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText('Search'));
    await waitFor(() =>
      expect(screen.getByLabelText('Name, phone or MR no.').props.value).toBe('03001234567'),
    );
  });

  it('forgets the duplicate answer after a successful register', async () => {
    mockCheckPhone.mockResolvedValue({ exists: true });
    mockCreate.mockResolvedValue(patient({ id: 'new-2' }));
    await renderPage();
    await fireEvent.press(screen.getByLabelText('Register patient'));
    await fill('Sara Khan', '03001234567');
    await fireEvent(screen.getByLabelText('Phone'), 'blur');
    expect(await screen.findByText('A patient with this phone already exists')).toBeTruthy();
    await fireEvent.press(screen.getByText('Register'));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    await fill('Next One', '03001234567');
    expect(screen.queryByText('A patient with this phone already exists')).toBeNull();
  });

  it('creates the patient, toasts, opens the record and remembers it', async () => {
    mockCheckPhone.mockResolvedValue({ exists: false });
    mockCreate.mockResolvedValue(patient({ id: 'new-1', fullName: 'Sara Khan' }));
    await renderPage();
    await fireEvent.press(screen.getByLabelText('Register patient'));
    await fill('Sara Khan', '03001234567');
    await fireEvent.press(screen.getByText('Register'));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: 'Sara Khan', phone: '03001234567' }),
      ),
    );
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/patients/[patientId]',
        params: { patientId: 'new-1' },
      }),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('Patient registered');
    expect(useRecentPatientsStore.getState().ids[0]).toBe('new-1');
  });
});
