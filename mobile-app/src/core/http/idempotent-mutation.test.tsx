import React from 'react';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { isRetryable, retryDelayMs } from './idempotency';
import { useIdempotentMutation } from './idempotent-mutation';

function httpError(status: number, code?: string) {
  const response = {
    status,
    data: code ? { error: { code } } : {},
    headers: {},
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
}

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK');

async function setup(mutationFn: jest.Mock) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return await renderHook(() => useIdempotentMutation<string, string>({ mutationFn }), { wrapper });
}

async function run(result: { current: { mutateAsync: (v: string) => Promise<string> } }) {
  let outcome: { ok: true; value: string } | { ok: false; error: unknown } | undefined;
  const p = act(async () => {
    const call = result.current.mutateAsync('x').then(
      (value) => {
        outcome = { ok: true, value };
      },
      (error: unknown) => {
        outcome = { ok: false, error };
      },
    );
    await jest.runAllTimersAsync();
    await call;
  });
  await p;
  return outcome;
}

describe('useIdempotentMutation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reuses the same key across retries of one call', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(httpError(503, 'LOCK_TIMEOUT'))
      .mockResolvedValueOnce('ok');
    const { result } = await setup(fn);

    const out = await run(result);

    expect(out).toEqual({ ok: true, value: 'ok' });
    expect(fn).toHaveBeenCalledTimes(3);
    const keys = fn.mock.calls.map((c) => c[1].idempotencyKey);
    expect(new Set(keys).size).toBe(1);
  });

  it('uses a new key for the next mutate() call', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const { result } = await setup(fn);

    await run(result);
    await run(result);

    expect(fn.mock.calls[0][1].idempotencyKey).not.toBe(fn.mock.calls[1][1].idempotencyKey);
  });

  it('stops immediately on a 4xx', async () => {
    const fn = jest.fn().mockRejectedValue(httpError(409, 'VERSION_CONFLICT'));
    const { result } = await setup(fn);

    const out = await run(result);

    expect(out?.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 503 that is not LOCK_TIMEOUT', async () => {
    const fn = jest.fn().mockRejectedValue(httpError(503, 'SOMETHING_ELSE'));
    const { result } = await setup(fn);

    await run(result);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 retries (4 calls) and surfaces the error', async () => {
    const fn = jest.fn().mockRejectedValue(networkError());
    const { result } = await setup(fn);

    const out = await run(result);

    expect(out?.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('waits the backoff delay between retries', async () => {
    const fn = jest.fn().mockRejectedValueOnce(networkError()).mockResolvedValueOnce('ok');
    const { result } = await setup(fn);

    let done = false;
    await act(async () => {
      void result.current.mutateAsync('x').then(() => {
        done = true;
      });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(done).toBe(true);
  });
});

describe('isRetryable / retryDelayMs', () => {
  it('retries network errors and 503 LOCK_TIMEOUT only', () => {
    expect(isRetryable(networkError())).toBe(true);
    expect(isRetryable(httpError(503, 'LOCK_TIMEOUT'))).toBe(true);
    expect(isRetryable(httpError(503))).toBe(false);
    expect(isRetryable(httpError(400))).toBe(false);
    expect(isRetryable(httpError(500))).toBe(false);
    expect(isRetryable(new Error('boom'))).toBe(false);
  });

  it('computes 250 × (attempt + 1) plus 0–100 ms jitter', () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const d = retryDelayMs(attempt);
      expect(d).toBeGreaterThanOrEqual(250 * (attempt + 1));
      expect(d).toBeLessThanOrEqual(250 * (attempt + 1) + 100);
    }
  });
});
