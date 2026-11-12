import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { switchSpace } from '@/core/space/switch-space';
import { dropSession } from '@/staff/lib/api';
import { wipeStaffPersistedCache } from '@/staff/lib/persist-cache';

import { logout } from '../api/auth.api';
import { useSignOut } from './useSignOut';

jest.mock('../api/auth.api', () => ({ logout: jest.fn() }));
jest.mock('@/staff/lib/api', () => ({ dropSession: jest.fn() }));
jest.mock('@/core/space/switch-space', () => ({ switchSpace: jest.fn() }));
jest.mock('@/staff/lib/persist-cache', () => ({ wipeStaffPersistedCache: jest.fn() }));

async function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['access', 'me'], { ok: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useSignOut(), { wrapper });
  return { queryClient, ...hook };
}

describe('useSignOut', () => {
  beforeEach(() => jest.clearAllMocks());

  it('wipes the staff cache, clears the client and leaves the space', async () => {
    (logout as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { result, queryClient } = await setup();
    const clearSpy = jest.spyOn(queryClient, 'clear');
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(dropSession).toHaveBeenCalled();
    expect(wipeStaffPersistedCache).toHaveBeenCalledTimes(1);
    // The wipe (which seals the persister) must run BEFORE the in-memory clear.
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect((wipeStaffPersistedCache as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      clearSpy.mock.invocationCallOrder[0],
    );
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(switchSpace).toHaveBeenCalledWith(null);
  });

  it('still signs out when the wipe fails', async () => {
    (wipeStaffPersistedCache as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const { result } = await setup();
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(switchSpace).toHaveBeenCalledWith(null);
  });
});
