import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import {
  StaffRealtimeProvider,
  isNotificationsPath,
  useRoomSubscription,
} from './realtime-provider';

const mockJoin = jest.fn();
const mockLeave = jest.fn();

jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('sonner-native', () => ({ toast: jest.fn() }));
jest.mock('@/staff/lib/api', () => ({ refreshSession: jest.fn() }));
jest.mock('./realtime', () => ({
  StaffRealtime: class {
    subscribe = () => () => {};
    isConnected = () => false;
    connect = jest.fn();
    attachAppLifecycle = () => () => {};
    dispose = jest.fn();
    setOnNotification = jest.fn();
    joinRoom = (room: string) => {
      mockJoin(room);
      return () => mockLeave(room);
    };
  },
}));

const joined = () => mockJoin.mock.calls.map((c) => c[0] as string).sort();
const left = () => mockLeave.mock.calls.map((c) => c[0] as string).sort();

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <StaffRealtimeProvider>{children}</StaffRealtimeProvider>
    </QueryClientProvider>
  );
}

describe('StaffRealtimeProvider rooms', () => {
  beforeEach(() => {
    mockJoin.mockClear();
    mockLeave.mockClear();
    useStaffAuthStore.setState({ activeOrganizationId: 'o1', activeLocationId: 'l1' });
  });

  it('always joins the active org room', async () => {
    await renderHook(() => undefined, { wrapper });
    expect(joined()).toEqual(['org:o1']);
  });

  it('leaves and re-joins every room when the active location changes', async () => {
    await renderHook(() => useRoomSubscription('location:l1:board'), { wrapper });
    expect(joined()).toEqual(['location:l1:board', 'org:o1']);
    mockJoin.mockClear();

    await act(async () => {
      useStaffAuthStore.setState({ activeLocationId: 'l2' });
    });

    expect(left()).toEqual(['location:l1:board', 'org:o1']);
    expect(joined()).toEqual(['location:l1:board', 'org:o1']);
  });

  it('moves the org room when the active organization changes', async () => {
    await renderHook(() => undefined, { wrapper });
    mockJoin.mockClear();
    await act(async () => {
      useStaffAuthStore.setState({ activeOrganizationId: 'o2', activeLocationId: 'l9' });
    });
    expect(left()).toEqual(['org:o1']);
    expect(joined()).toEqual(['org:o2']);
  });

  it('a null room joins nothing extra', async () => {
    await renderHook(() => useRoomSubscription(null), { wrapper });
    expect(joined()).toEqual(['org:o1']);
  });
});

describe('isNotificationsPath', () => {
  it('matches the notifications screen only', () => {
    expect(isNotificationsPath('/notifications')).toBe(true);
    expect(isNotificationsPath('/(staff)/(main)/notifications')).toBe(true);
    expect(isNotificationsPath('/patients')).toBe(false);
    expect(isNotificationsPath('/more/notification-settings')).toBe(false);
  });
});
