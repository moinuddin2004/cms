import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { queueKeys } from '../api/queue.keys';
import { useBoard } from './useBoard';
import { useMySession } from './useMySession';
import { usePatientQueueVisits } from './usePatientQueueVisits';
import { useSession } from './useSession';
import { useTicket } from './useTicket';

const mockJoin = jest.fn();
const mockLeave = jest.fn();
let mockStatus: 'live' | 'reconnecting' | 'offline' = 'live';

jest.mock('@/staff/lib/realtime-provider', () => ({
  useRealtimeStatus: () => mockStatus,
  // Same contract as the real hook: join while mounted, leave on unmount / room change.
  useRoomSubscription: (room: string | null) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => {
      if (!room) return;
      mockJoin(room);
      return () => mockLeave(room);
    }, [room]);
  },
}));
jest.mock('@/staff/lib/datetime', () => ({ todayYmd: () => '2026-11-14' }));

const mockFetchMySession = jest.fn();
const mockFetchBoard = jest.fn();
const mockFetchSession = jest.fn();
const mockFetchTicket = jest.fn();
const mockFetchPatientVisits = jest.fn();
jest.mock('../api/queue.api', () => ({
  fetchMySession: (...a: unknown[]) => mockFetchMySession(...a),
  fetchBoard: (...a: unknown[]) => mockFetchBoard(...a),
  fetchSession: (...a: unknown[]) => mockFetchSession(...a),
  fetchTicket: (...a: unknown[]) => mockFetchTicket(...a),
  fetchPatientVisits: (...a: unknown[]) => mockFetchPatientVisits(...a),
}));

const snapshot = (id: string) => ({ session: { id, eventSeq: 1 }, entries: [] });

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

/** Let pending promises and `ms` of fake time pass. */
const tick = (ms = 0) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('queue read hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStatus = 'live';
    useStaffAuthStore.setState({ activeOrganizationId: 'o1', activeLocationId: 'l1' });
    mockFetchMySession.mockResolvedValue(snapshot('s1'));
    mockFetchBoard.mockResolvedValue({ serviceDate: '2026-11-14', lanes: [] });
    mockFetchSession.mockResolvedValue(snapshot('s2'));
    mockFetchTicket.mockResolvedValue({ entryId: 'e1' });
    mockFetchPatientVisits.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  describe('useMySession', () => {
    it('keys by location + today, and joins the session room once the id is known', async () => {
      const { client, wrapper } = makeWrapper();
      const { unmount } = await renderHook(() => useMySession(), { wrapper });
      expect(mockJoin).not.toHaveBeenCalled();

      await tick();
      expect(client.getQueryData(queueKeys.mySession('l1', '2026-11-14'))).toEqual(snapshot('s1'));
      expect(mockJoin).toHaveBeenCalledWith('session:s1');

      await unmount();
      expect(mockLeave).toHaveBeenCalledWith('session:s1');
    });

    it('does not fetch without an active location', async () => {
      useStaffAuthStore.setState({ activeLocationId: null });
      const { wrapper } = makeWrapper();
      await renderHook(() => useMySession(), { wrapper });
      await tick();
      expect(mockFetchMySession).not.toHaveBeenCalled();
    });

    it('does not poll while realtime is live', async () => {
      const { wrapper } = makeWrapper();
      await renderHook(() => useMySession(), { wrapper });
      await tick();
      await tick(35_000);
      expect(mockFetchMySession).toHaveBeenCalledTimes(1);
    });

    it('polls every 10 s while realtime is not live', async () => {
      mockStatus = 'reconnecting';
      const { wrapper } = makeWrapper();
      await renderHook(() => useMySession(), { wrapper });
      await tick();
      expect(mockFetchMySession).toHaveBeenCalledTimes(1);
      await tick(10_000);
      expect(mockFetchMySession).toHaveBeenCalledTimes(2);
      await tick(10_000);
      expect(mockFetchMySession).toHaveBeenCalledTimes(3);
    });

    it('is stale immediately (staleTime 0): a new mount refetches', async () => {
      const { wrapper } = makeWrapper();
      const first = await renderHook(() => useMySession(), { wrapper });
      await tick();
      await first.unmount();
      await renderHook(() => useMySession(), { wrapper });
      await tick();
      expect(mockFetchMySession).toHaveBeenCalledTimes(2);
    });
  });

  describe('useBoard', () => {
    it('fetches today, joins the location board room while mounted, leaves on unmount', async () => {
      const { client, wrapper } = makeWrapper();
      const { unmount } = await renderHook(() => useBoard(), { wrapper });
      await tick();
      expect(mockFetchBoard).toHaveBeenCalledWith('2026-11-14');
      expect(client.getQueryData(queueKeys.board('l1', '2026-11-14'))).toBeDefined();
      expect(mockJoin).toHaveBeenCalledWith('location:l1:board');

      await unmount();
      expect(mockLeave).toHaveBeenCalledWith('location:l1:board');
    });

    it('polls only when realtime is not live', async () => {
      mockStatus = 'offline';
      const { wrapper } = makeWrapper();
      await renderHook(() => useBoard(), { wrapper });
      await tick();
      await tick(10_000);
      expect(mockFetchBoard).toHaveBeenCalledTimes(2);
    });
  });

  describe('useSession', () => {
    it('joins session:<id>, and joins nothing without an id', async () => {
      const { wrapper } = makeWrapper();
      const { unmount } = await renderHook(() => useSession('s2'), { wrapper });
      await tick();
      expect(mockFetchSession).toHaveBeenCalledWith('s2');
      expect(mockJoin).toHaveBeenCalledWith('session:s2');
      await unmount();
      expect(mockLeave).toHaveBeenCalledWith('session:s2');

      mockJoin.mockClear();
      mockFetchSession.mockClear();
      await renderHook(() => useSession(undefined), { wrapper });
      await tick();
      expect(mockFetchSession).not.toHaveBeenCalled();
      expect(mockJoin).not.toHaveBeenCalled();
    });

    it('polls only when realtime is not live', async () => {
      mockStatus = 'reconnecting';
      const { wrapper } = makeWrapper();
      await renderHook(() => useSession('s2'), { wrapper });
      await tick();
      await tick(10_000);
      expect(mockFetchSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('useTicket / usePatientQueueVisits', () => {
    it('fetch by id and stay disabled without one', async () => {
      const { wrapper } = makeWrapper();
      await renderHook(() => useTicket('e1'), { wrapper });
      await renderHook(() => usePatientQueueVisits('p1'), { wrapper });
      await renderHook(() => useTicket(undefined), { wrapper });
      await renderHook(() => usePatientQueueVisits(undefined), { wrapper });
      await tick();
      expect(mockFetchTicket).toHaveBeenCalledTimes(1);
      expect(mockFetchTicket).toHaveBeenCalledWith('e1');
      expect(mockFetchPatientVisits).toHaveBeenCalledTimes(1);
      expect(mockFetchPatientVisits).toHaveBeenCalledWith('p1');
    });
  });
});
