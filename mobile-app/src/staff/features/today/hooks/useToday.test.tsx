import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import {
  useDoctorsNow,
  useNextAppointments,
  useTodayCollections,
  useTodayStats,
} from './useToday';

const mockFetch = {
  stats: jest.fn(),
  upcoming: jest.fn(),
  board: jest.fn(),
  daily: jest.fn(),
  invoiceStats: jest.fn(),
};

jest.mock('@/staff/features/appointments', () => ({
  appointmentKeys: {
    stats: (o: string, l: string, d: string) => ['appointments', 'stats', o, l, d],
    upcoming: (o: string, l: string, d: string, n: number) => [
      'appointments',
      'upcoming',
      o,
      l,
      d,
      n,
    ],
  },
  fetchAppointmentStats: (...a: unknown[]) => mockFetch.stats(...a),
  fetchUpcomingAppointments: (...a: unknown[]) => mockFetch.upcoming(...a),
}));
jest.mock('@/staff/features/queue', () => ({
  fetchBoard: (...a: unknown[]) => mockFetch.board(...a),
}));
jest.mock('../api/today.api', () => ({
  fetchDailySummary: (...a: unknown[]) => mockFetch.daily(...a),
  fetchInvoiceStats: (...a: unknown[]) => mockFetch.invoiceStats(...a),
}));
jest.mock('@/staff/lib/clinic-today', () => ({ useClinicToday: () => '2026-11-15' }));

let mockPerms = new Set<string>();
let mockFeatures = new Set<string>();
let mockStatus = 'ready';
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({
    status: mockStatus,
    can: (p: string) => mockPerms.has(p),
    hasFeature: (f: string) => mockFeatures.has(f),
  }),
}));

const clients: QueryClient[] = [];

async function setup<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const rendered = await renderHook(hook, { wrapper });
  return { client, result: rendered.result };
}

const noRequests = () => Object.values(mockFetch).forEach((m) => expect(m).not.toHaveBeenCalled());

afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
});

beforeEach(() => {
  Object.values(mockFetch).forEach((m) => m.mockReset());
  mockPerms = new Set();
  mockFeatures = new Set();
  mockStatus = 'ready';
  useStaffAuthStore.setState({ activeOrganizationId: 'o1', activeLocationId: 'l1' });
});

const HOOKS: ReadonlyArray<readonly [string, () => unknown, string]> = [
  ['useTodayStats', () => useTodayStats(), 'appointments.view'],
  ['useTodayCollections', () => useTodayCollections(), 'billing.invoice.view'],
  ['useDoctorsNow', () => useDoctorsNow(), 'queue.board.view'],
  ['useNextAppointments', () => useNextAppointments(5), 'appointments.view'],
];

describe.each(HOOKS)('%s gating', (_name, hook) => {
  it('sends no request and reports denied without the permission', async () => {
    const { result } = await setup(hook as () => unknown);
    expect(result.current).toEqual({ access: 'denied' });
    await new Promise((r) => setTimeout(r, 20));
    noRequests();
  });

  it('reports loading (no request) while access is loading, even with the grant', async () => {
    mockStatus = 'loading';
    HOOKS.forEach((h) => mockPerms.add(h[2]));
    const { result } = await setup(hook as () => unknown);
    expect(result.current).toEqual({ access: 'loading' });
    await new Promise((r) => setTimeout(r, 20));
    noRequests();
  });

  it('sends no request without a location', async () => {
    HOOKS.forEach((h) => mockPerms.add(h[2]));
    useStaffAuthStore.setState({ activeLocationId: null });
    await setup(hook as () => unknown);
    await new Promise((r) => setTimeout(r, 20));
    noRequests();
  });
});

describe('allowed', () => {
  it('useTodayStats fetches today stats', async () => {
    mockPerms.add('appointments.view');
    mockFetch.stats.mockResolvedValue({ total: 3 });
    const { result } = await setup(() => useTodayStats());
    await waitFor(() => {
      expect(result.current.access).toBe('allowed');
      if (result.current.access === 'allowed') expect(result.current.query.data).toEqual({ total: 3 });
    });
    expect(mockFetch.stats).toHaveBeenCalledWith('2026-11-15');
  });

  it('useNextAppointments passes the limit and puts org, location, day in the key', async () => {
    mockPerms.add('appointments.view');
    mockFetch.upcoming.mockResolvedValue([]);
    const { client } = await setup(() => useNextAppointments(5));
    await waitFor(() => expect(mockFetch.upcoming).toHaveBeenCalled());
    expect(mockFetch.upcoming.mock.calls[0]?.[1]).toBe('2026-11-15');
    expect(mockFetch.upcoming.mock.calls[0]?.[2]).toBe(5);
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'appointments',
      'upcoming',
      'o1',
      'l1',
      '2026-11-15',
      5,
    ]);
  });

  it('useDoctorsNow maps board lanes', async () => {
    mockPerms.add('queue.board.view');
    mockFetch.board.mockResolvedValue({
      lanes: [
        { doctor: { id: 'd1', fullName: 'Dr. Sana' }, snapshot: null },
      ],
    });
    const { result, client } = await setup(() => useDoctorsNow());
    await waitFor(() => {
      if (result.current.access !== 'allowed') throw new Error('not yet');
      expect(result.current.query.data).toHaveLength(1);
    });
    expect(mockFetch.board).toHaveBeenCalledWith('2026-11-15');
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'today',
      'doctors-now',
      'o1',
      'l1',
      '2026-11-15',
    ]);
  });
});

describe('useTodayCollections', () => {
  const summary = {
    totalCollections: 84000,
    invoicesGenerated: 9,
    paymentMethodBreakdown: {},
    outstandingAmount: 12000.5,
    overdueCount: 2,
  };
  const stats = {
    counts: { UNPAID: 3, PARTIALLY_PAID: 1, OVERDUE: 2, PAID: 5, REFUNDED: 0, CANCELLED: 0 },
    totals: { invoiced: 100, collected: 40, outstanding: 60, overdue: 20, refunded: 0 },
  };

  it('uses the daily summary with reports.financial.view and the feature on', async () => {
    mockPerms = new Set(['billing.invoice.view', 'reports.financial.view']);
    mockFeatures.add('billing.financial_summary');
    mockFetch.daily.mockResolvedValue(summary);
    const { result } = await setup(() => useTodayCollections());
    await waitFor(() => {
      if (result.current.access !== 'allowed') throw new Error('not yet');
      expect(result.current.query.data).toEqual({
        source: 'daily',
        collected: 84000,
        outstanding: 12000.5,
        overdueCount: 2,
        invoicesGenerated: 9,
        unpaidCount: null,
      });
    });
    expect(mockFetch.daily).toHaveBeenCalledWith('2026-11-15');
    expect(mockFetch.invoiceStats).not.toHaveBeenCalled();
  });

  it('falls back to invoice stats when the feature is off', async () => {
    mockPerms = new Set(['billing.invoice.view', 'reports.financial.view']);
    mockFetch.invoiceStats.mockResolvedValue(stats);
    const { result } = await setup(() => useTodayCollections());
    await waitFor(() => {
      if (result.current.access !== 'allowed') throw new Error('not yet');
      expect(result.current.query.data).toEqual({
        source: 'invoices',
        collected: 40,
        outstanding: 60,
        overdueCount: 2,
        invoicesGenerated: null,
        unpaidCount: 6,
      });
    });
    expect(mockFetch.invoiceStats).toHaveBeenCalledWith('2026-11-15', '2026-11-15');
    expect(mockFetch.daily).not.toHaveBeenCalled();
  });

  it('falls back to invoice stats without reports.financial.view (feature on)', async () => {
    mockPerms = new Set(['billing.invoice.view']);
    mockFeatures.add('billing.financial_summary');
    mockFetch.invoiceStats.mockResolvedValue(stats);
    await setup(() => useTodayCollections());
    await waitFor(() => expect(mockFetch.invoiceStats).toHaveBeenCalledTimes(1));
    expect(mockFetch.daily).not.toHaveBeenCalled();
  });

  it('never calls the daily summary with only reports.financial.view', async () => {
    mockPerms = new Set(['reports.financial.view']);
    mockFeatures.add('billing.financial_summary');
    const { result } = await setup(() => useTodayCollections());
    expect(result.current).toEqual({ access: 'denied' });
    await new Promise((r) => setTimeout(r, 20));
    noRequests();
  });

  it('keys the two sources apart', async () => {
    mockPerms = new Set(['billing.invoice.view']);
    mockFetch.invoiceStats.mockResolvedValue(stats);
    const { client } = await setup(() => useTodayCollections());
    await waitFor(() => expect(mockFetch.invoiceStats).toHaveBeenCalled());
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'today',
      'collections',
      'o1',
      'l1',
      '2026-11-15',
      'invoices',
    ]);
  });
});
