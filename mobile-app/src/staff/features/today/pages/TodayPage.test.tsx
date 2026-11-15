import { fireEvent, render, screen } from '@testing-library/react-native';

import type { GatedQuery } from '../hooks/gated-query';
import { avgWaitLabel, doctorNowSummary } from '../lib/today-format';

import { TodayPage } from './TodayPage';

const mockNavigate = jest.fn();
let mockStatus: 'ready' | 'loading' = 'ready';
let mockGrants = new Set<string>();

const allowed = <T,>(data: T | undefined, extra: object = {}): GatedQuery<T> =>
  ({
    access: 'allowed',
    query: { data, isError: false, refetch: jest.fn(), ...extra },
  }) as unknown as GatedQuery<T>;

let mockStats: GatedQuery<unknown>;
let mockCollections: GatedQuery<unknown>;
let mockDoctors: GatedQuery<unknown>;
let mockNext: GatedQuery<unknown>;

jest.mock('../hooks/useToday', () => ({
  useTodayStats: () => mockStats,
  useTodayCollections: () => mockCollections,
  useDoctorsNow: () => mockDoctors,
  useNextAppointments: () => mockNext,
}));
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({
    status: mockStatus,
    can: (p: string) => mockGrants.has(p),
    hasFeature: () => true,
  }),
  AccessErrorState: () => null,
}));
jest.mock('@/staff/features/more', () => ({ LocationSwitcherButton: () => null }));
jest.mock('@/staff/features/notifications', () => ({ NotificationBell: () => null }));
jest.mock('@/staff/lib/clinic-today', () => ({ useClinicToday: () => '2026-11-15' }));
jest.mock('@/staff/lib/currency', () => ({
  formatCurrency: (n: number) => `PKR ${n.toLocaleString('en-US')}`,
}));
jest.mock('@/staff/lib/datetime', () => ({
  formatInClinic: () => 'Sun, Nov 15',
  formatTime: () => '10:30 AM',
}));
jest.mock('@/staff/store/useStaffAuthStore', () => ({
  useStaffAuthStore: (sel: (s: unknown) => unknown) => sel({ activeLocationId: 'l1' }),
  activeOrganization: () => ({ locations: [{ id: 'l1', name: 'Main branch' }] }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, canGoBack: () => false }),
}));
jest.mock('@/core/components', () => {
  const rn = jest.requireActual<typeof import('react-native')>('react-native');
  const R = jest.requireActual<typeof import('react')>('react');
  const t = (props: { title?: string; label?: string; value?: unknown; meta?: string }) =>
    R.createElement(
      rn.Text,
      null,
      [props.title, props.label, props.value, props.meta].filter((x) => x != null).join(' | '),
    );
  return {
    Screen: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) =>
      R.createElement(rn.View, null, header, children),
    ScreenHeader: ({ title, subtitle }: { title: string; subtitle: string }) =>
      R.createElement(rn.Text, null, `${title} ${subtitle}`),
    EmptyState: t,
    ErrorState: ({ title, onRetry }: { title: string; onRetry: () => void }) =>
      R.createElement(rn.Pressable, { onPress: onRetry }, R.createElement(rn.Text, null, title)),
    StatTile: t,
    ListRow: ({ title, meta, onPress }: { title: string; meta?: string; onPress?: () => void }) =>
      R.createElement(
        rn.Pressable,
        { onPress },
        R.createElement(rn.Text, null, `${title} ${meta}`),
      ),
    SectionHeader: ({ title, action }: { title: string; action?: { onPress: () => void } }) =>
      R.createElement(
        rn.Pressable,
        { onPress: action?.onPress },
        R.createElement(rn.Text, null, title),
      ),
    StatusBadge: () => null,
    APPOINTMENT_STATUS_TONES: { scheduled: { label: 'Scheduled', tone: 'neutral' } },
  };
});
jest.mock('@/core/ui/skeleton', () => ({ Skeleton: () => null }));

const stats = { total: 34, waiting: 6, avgWaitMinutes: 18 };
const doctors = [
  {
    doctorId: 'd1',
    doctorName: 'Dr. Sana',
    status: 'open',
    nowServing: 'A-012',
    nowServingStatus: 'in_consultation',
    waitingCount: 4,
  },
];
const collections = {
  source: 'invoices',
  collected: 84000.5,
  outstanding: 0,
  overdueCount: 0,
  invoicesGenerated: null,
  unpaidCount: 3,
};
const next = [
  {
    id: 'a1',
    status: 'scheduled',
    startTime: '2026-11-15T05:30:00Z',
    patient: { fullName: 'Ali Raza' },
    doctor: { fullName: 'Dr. Sana' },
  },
];

beforeEach(() => {
  mockNavigate.mockClear();
  mockStatus = 'ready';
  mockGrants = new Set(['appointments.view', 'billing.invoice.view', 'queue.board.view']);
  mockStats = allowed(stats);
  mockCollections = allowed(collections);
  mockDoctors = allowed(doctors);
  mockNext = allowed(next);
});

describe('TodayPage', () => {
  it('owner: all four blocks, decimal money shown as is', async () => {
    await render(<TodayPage />);
    expect(screen.getByText('Today Sun, Nov 15 · Main branch')).toBeTruthy();
    expect(screen.getByText(/Appointments \| 34/)).toBeTruthy();
    expect(screen.getByText(/Avg wait \| 18m/)).toBeTruthy();
    expect(screen.getByText(/Collected today \| PKR 84,000.5/)).toBeTruthy();
    expect(screen.getByText('Dr. Sana A-012 · 4 waiting')).toBeTruthy();
    expect(screen.getByText('Ali Raza 10:30 AM')).toBeTruthy();
  });

  it('receptionist: no collections block', async () => {
    mockGrants = new Set(['appointments.view', 'queue.board.view']);
    mockCollections = { access: 'denied' };
    await render(<TodayPage />);
    expect(screen.queryByText(/Collected today/)).toBeNull();
    expect(screen.getByText(/Appointments \| 34/)).toBeTruthy();
  });

  it('doctor with no overview permission: empty state', async () => {
    mockGrants = new Set(['queue.doctor.own']);
    mockStats = mockCollections = mockDoctors = mockNext = { access: 'denied' };
    await render(<TodayPage />);
    expect(screen.getByText('Nothing to show here')).toBeTruthy();
  });

  it('a failing block shows its own retry and leaves the others', async () => {
    const refetch = jest.fn();
    mockDoctors = allowed(undefined, { isError: true, refetch });
    await render(<TodayPage />);
    expect(screen.getByText(/Appointments \| 34/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Could not load doctors'));
    expect(refetch).toHaveBeenCalled();
  });

  it('empty doctors and appointments show their messages', async () => {
    mockDoctors = allowed([]);
    mockNext = allowed([]);
    await render(<TodayPage />);
    expect(screen.getByText('No doctors on the board')).toBeTruthy();
    expect(screen.getByText('No more appointments today')).toBeTruthy();
  });

  it('doctor row opens the Queue tab, All opens Schedule', async () => {
    await render(<TodayPage />);
    await fireEvent.press(screen.getByText('Dr. Sana A-012 · 4 waiting'));
    expect(mockNavigate).toHaveBeenCalledWith('/queue');
    await fireEvent.press(screen.getByText('Next appointments'));
    expect(mockNavigate).toHaveBeenCalledWith('/schedule');
  });
});

describe('today-format', () => {
  it('avg wait', async () => {
    expect(avgWaitLabel(null)).toBe('—');
    expect(avgWaitLabel(17.6)).toBe('18m');
  });
  it('doctor summary', async () => {
    const base = {
      doctorId: 'd',
      doctorName: 'D',
      nowServing: null,
      nowServingStatus: null,
      waitingCount: 2,
    } as const;
    expect(doctorNowSummary({ ...base, status: 'no_session' })).toBe('No session');
    expect(doctorNowSummary({ ...base, status: 'paused' })).toBe('— paused');
    expect(doctorNowSummary({ ...base, status: 'closed' })).toBe('Closed');
    expect(doctorNowSummary({ ...base, status: 'open' })).toBe('2 waiting');
    expect(doctorNowSummary({ ...base, status: 'open', nowServing: 'A-1' })).toBe(
      'A-1 · 2 waiting',
    );
  });
});
