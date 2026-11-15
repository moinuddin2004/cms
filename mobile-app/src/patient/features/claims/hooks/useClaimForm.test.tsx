import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { AxiosError, type AxiosResponse } from 'axios';
import type { ReactNode } from 'react';

import { useClaimForm } from './useClaimForm';

const mockAccept = jest.fn();
jest.mock('../api/claims.api', () => ({ acceptClaim: (...a: unknown[]) => mockAccept(...a) }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

function apiError(status: number, code: string) {
  const err = new AxiosError('x');
  err.response = { status, data: { code } } as AxiosResponse;
  return err;
}

async function submit(onLinked: jest.Mock, onTerminal: jest.Mock) {
  const { result } = await renderHook(() => useClaimForm('t'.repeat(43), false, onLinked, onTerminal), { wrapper });
  await act(async () => {
    result.current.form.setFieldValue('confirm', true);
    await result.current.form.handleSubmit();
  });
  return result;
}

describe('useClaimForm', () => {
  beforeEach(() => mockAccept.mockReset());

  it.each(['CLAIM_INVALID', 'ALREADY_LINKED', 'CLINIC_SUSPENDED', 'PATIENT_APP_DISABLED'])(
    'reports %s as a terminal error with its message key (no navigation)',
    async (code) => {
      mockAccept.mockRejectedValue(apiError(code === 'ALREADY_LINKED' ? 409 : 403, code));
      const onTerminal = jest.fn();
      await submit(jest.fn(), onTerminal);
      expect(onTerminal).toHaveBeenCalledTimes(1);
      expect(onTerminal.mock.calls[0][0]).toMatch(/^claim\.errors\./);
    },
  );

  it('keeps the form open for a recoverable error', async () => {
    mockAccept.mockRejectedValue(apiError(400, 'RELATION_MISMATCH'));
    const onTerminal = jest.fn();
    const result = await submit(jest.fn(), onTerminal);
    expect(onTerminal).not.toHaveBeenCalled();
    expect(result.current.globalError).not.toBe('');
  });

  it('calls onLinked on success', async () => {
    mockAccept.mockResolvedValue({ link: {}, profile: {} });
    const onLinked = jest.fn();
    await submit(onLinked, jest.fn());
    expect(onLinked).toHaveBeenCalledTimes(1);
  });
});
