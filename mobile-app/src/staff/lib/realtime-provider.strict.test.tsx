import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import { StrictMode, type ReactNode } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { StaffRealtimeProvider } from './realtime-provider';

const sockets: { active: boolean; connected: boolean }[] = [];

jest.mock('expo-router', () => ({ usePathname: () => '/' }));
jest.mock('sonner-native', () => ({ toast: jest.fn() }));
jest.mock('@/staff/lib/api', () => ({ refreshSession: jest.fn() }));
jest.mock('socket.io-client', () => ({
  io: () => {
    const s = {
      active: false,
      connected: false,
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
      connect: jest.fn(() => {
        s.active = true;
      }),
      disconnect: jest.fn(() => {
        s.active = false;
        s.connected = false;
      }),
    };
    sockets.push(s);
    return s;
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <QueryClientProvider client={new QueryClient()}>
        <StaffRealtimeProvider>{children}</StaffRealtimeProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

describe('StaffRealtimeProvider under StrictMode', () => {
  it('leaves exactly one live socket after the double effect run', async () => {
    useStaffAuthStore.setState({ activeOrganizationId: 'o1', activeLocationId: 'l1' });
    await renderHook(() => undefined, { wrapper });
    expect(sockets.filter((s) => s.active)).toHaveLength(1);
  });
});
