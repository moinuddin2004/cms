import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { signOutPatient } from '@/patient/features/auth';

import { deleteAccount } from '../api/account.api';
import { useDeleteAccount } from './useDeleteAccount';

jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/core/i18n', () => ({ t: (key: string) => key }));
jest.mock('../api/account.api');
jest.mock('@/patient/features/auth', () => ({ signOutPatient: jest.fn() }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useDeleteAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes on the server first, then wipes this phone', async () => {
    const order: string[] = [];
    jest.mocked(deleteAccount).mockImplementation(async () => void order.push('delete'));
    jest.mocked(signOutPatient).mockImplementation(async () => void order.push('wipe'));

    const { result } = await renderHook(() => useDeleteAccount(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(order).toEqual(['delete', 'wipe']);
  });

  it('a failed delete leaves the session and cache untouched', async () => {
    jest.mocked(deleteAccount).mockRejectedValue(new Error('offline'));

    const { result } = await renderHook(() => useDeleteAccount(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(signOutPatient).not.toHaveBeenCalled();
  });
});
