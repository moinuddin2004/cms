import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSwitchLocation } from './useSwitchLocation';

const mockSwitch = jest.fn();
const mockSetContext = jest.fn();

jest.mock('@/staff/features/auth', () => ({
  switchLocation: (...a: unknown[]) => mockSwitch(...a),
}));
jest.mock('@/staff/features/access', () => ({
  accessKeys: { all: ['access'] },
}));
jest.mock('@/staff/store/useStaffAuthStore', () => ({
  useStaffAuthStore: (sel: (s: unknown) => unknown) => sel({ setLocationContext: mockSetContext }),
}));
jest.mock('sonner-native', () => ({ toast: { error: jest.fn() } }));

async function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(['access', 'me', 'o1', 'l1'], { ok: true });
  client.setQueryData(['queue', 'l1'], { rows: [] });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => useSwitchLocation(), { wrapper });
  return { client, result };
}

describe('useSwitchLocation', () => {
  beforeEach(() => {
    mockSwitch.mockReset();
    mockSetContext.mockReset();
  });

  it('on success clears the cache first, then moves the store', async () => {
    mockSwitch.mockResolvedValue({
      activeOrganizationId: 'o2',
      activeLocationId: 'l2',
    });
    const { client, result } = await setup();
    mockSetContext.mockImplementation(() => {
      expect(client.getQueryData(['queue', 'l1'])).toBeUndefined();
    });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: 'o2',
        locationId: 'l2',
      });
    });

    expect(mockSetContext).toHaveBeenCalledWith('o2', 'l2');
    expect(client.getQueryData(['access', 'me', 'o1', 'l1'])).toEqual({
      ok: true,
    });
  });

  it('on error changes neither the store nor the cache', async () => {
    mockSwitch.mockRejectedValue(new Error('boom'));
    const { client, result } = await setup();

    await act(async () => {
      await result.current.mutateAsync({ organizationId: 'o2', locationId: 'l2' }).catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockSetContext).not.toHaveBeenCalled();
    expect(client.getQueryData(['queue', 'l1'])).toEqual({ rows: [] });
    expect(client.getQueryData(['access', 'me', 'o1', 'l1'])).toEqual({
      ok: true,
    });
  });
});
