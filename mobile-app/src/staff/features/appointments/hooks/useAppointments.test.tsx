import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import * as api from '../api/appointments.api';
import type { AppointmentListItem } from '../types/appointments.types';

import {
  useAppointment,
  useArrivals,
  useDayAppointments,
  useDoctors,
  useUpcomingAppointments,
} from './useAppointments';

let mockScope: { activeOrganizationId: string | null; activeLocationId: string | null } = {
  activeOrganizationId: 'o1',
  activeLocationId: 'l1',
};

jest.mock('@/staff/store/useStaffAuthStore', () => ({
  useStaffAuthStore: (sel: (s: unknown) => unknown) => sel(mockScope),
}));
jest.mock('@/staff/lib/datetime', () => ({ todayYmd: () => '2026-11-14' }));
jest.mock('../api/appointments.api', () => ({
  APPOINTMENTS_PAGE_SIZE: 50,
  fetchAppointments: jest.fn(),
  fetchAllDayBookings: jest.fn(),
  fetchAppointment: jest.fn(),
  fetchAppointmentStats: jest.fn(),
  fetchDoctors: jest.fn(),
  fetchUpcomingAppointments: jest.fn(),
}));

const m = api as jest.Mocked<typeof api>;
const YMD = '2026-11-14';

function wrapperFor(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const item = (id: string, over: Partial<AppointmentListItem> = {}) =>
  ({ id, status: 'scheduled', startTime: '2026-11-14T05:00:00.000Z', queueEntry: null, ...over }) as AppointmentListItem;

describe('appointments hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScope = { activeOrganizationId: 'o1', activeLocationId: 'l1' };
  });

  it('pages the day list while page * limit < total', async () => {
    m.fetchAppointments
      .mockResolvedValueOnce({ data: [item('a')], total: 3, page: 1, limit: 2 })
      .mockResolvedValueOnce({ data: [item('b')], total: 3, page: 2, limit: 2 });
    const client = newClient();
    const { result } = await renderHook(() => useDayAppointments(YMD), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(m.fetchAppointments).toHaveBeenLastCalledWith(YMD, {}, 2, 50);
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.data?.pages.flatMap((p) => p.data.map((r) => r.id))).toEqual(['a', 'b']);
  });

  it('keys the list by org, location and day', async () => {
    m.fetchAppointments.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
    const client = newClient();
    await renderHook(() => useDayAppointments(YMD), { wrapper: wrapperFor(client) });
    await waitFor(() =>
      expect(client.getQueryState(['appointments', 'list', 'o1', 'l1', YMD])?.status).toBe('success'),
    );
  });

  it('makes no request without an active location', async () => {
    mockScope = { activeOrganizationId: 'o1', activeLocationId: null };
    const client = newClient();
    const { result } = await renderHook(() => useDayAppointments(YMD), { wrapper: wrapperFor(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(m.fetchAppointments).not.toHaveBeenCalled();
  });

  it('does not fetch a detail without an id and caches per location', async () => {
    const client = newClient();
    const { result } = await renderHook(() => useAppointment(undefined), { wrapper: wrapperFor(client) });
    expect(result.current.fetchStatus).toBe('idle');
    m.fetchAppointment.mockResolvedValue({ id: 'a1' } as never);
    await renderHook(() => useAppointment('a1'), { wrapper: wrapperFor(client) });
    await waitFor(() =>
      expect(client.getQueryData(['appointments', 'detail', 'o1', 'l1', 'a1'])).toEqual({ id: 'a1' }),
    );
  });

  it('useArrivals returns only un-arrived bookings, sorted', async () => {
    m.fetchAllDayBookings.mockResolvedValue([
      item('late', { startTime: '2026-11-14T09:00:00.000Z' }),
      item('early', { status: 'confirmed' }),
      item('in', { queueEntry: { id: 'e', token: 'A-1', status: 'waiting', sessionId: 's' } }),
      item('chk', { status: 'checked_in' }),
    ]);
    const { result } = await renderHook(() => useArrivals(YMD), { wrapper: wrapperFor(newClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((r) => r.id)).toEqual(['early', 'late']);
  });

  it('useDoctors caches under the location', async () => {
    m.fetchDoctors.mockResolvedValue([]);
    const client = newClient();
    await renderHook(() => useDoctors(), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(client.getQueryState(['appointments', 'doctors', 'o1', 'l1'])?.status).toBe('success'));
  });

  it('useUpcomingAppointments starts from now, ends the clinic day, and keys by scope + limit', async () => {
    m.fetchUpcomingAppointments.mockResolvedValue([item('a')]);
    const client = newClient();
    const before = Date.now();
    const { result } = await renderHook(() => useUpcomingAppointments(5), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [from, ymd, limit] = m.fetchUpcomingAppointments.mock.calls[0];
    expect(Date.parse(from)).toBeGreaterThanOrEqual(before);
    expect([ymd, limit]).toEqual(['2026-11-14', 5]);
    expect(client.getQueryState(['appointments', 'upcoming', 'o1', 'l1', '2026-11-14', 5])?.status).toBe('success');
  });
});
