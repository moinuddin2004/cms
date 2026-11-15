import type { InternalAxiosRequestConfig } from 'axios';

import { createApiClient, createSingleFlight, extractErrorCode } from './create-api-client';

describe('createSingleFlight', () => {
  it('shares one in-flight call and runs again after it settles', async () => {
    let release!: (v: number) => void;
    const fn = jest.fn(() => new Promise<number>((resolve) => (release = resolve)));
    const run = createSingleFlight(fn);
    const a = run();
    const b = run();
    expect(fn).toHaveBeenCalledTimes(1);
    release(1);
    await expect(Promise.all([a, b])).resolves.toEqual([1, 1]);
    const c = run();
    expect(fn).toHaveBeenCalledTimes(2);
    release(2);
    await c;
  });

  it('runs again after a failure', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(5);
    const run = createSingleFlight(fn);
    await expect(run()).rejects.toThrow('x');
    await expect(run()).resolves.toBe(5);
  });
});

describe('extractErrorCode', () => {
  it('reads a top-level or nested code', () => {
    expect(extractErrorCode({ response: { data: { code: 'A' } } })).toBe('A');
    expect(extractErrorCode({ response: { data: { error: { code: 'B' } } } })).toBe('B');
    expect(extractErrorCode({ response: { data: {} } })).toBeUndefined();
    expect(extractErrorCode(undefined)).toBeUndefined();
  });
});

function failure(config: InternalAxiosRequestConfig, status: number): Error {
  return Object.assign(new Error('x'), {
    config,
    isAxiosError: true,
    response: { status, headers: {}, data: { code: 'FORBIDDEN_X' }, config },
  });
}

describe('createApiClient', () => {
  it('retries a 401 once with the refreshed token, then gives up', async () => {
    const refreshSession = jest.fn(async () => ({ accessToken: 'new' }));
    const client = createApiClient({
      baseURL: 'http://x',
      onRequest: () => undefined,
      refreshSession,
      noRefreshUrls: ['/auth/'],
    });
    const seen: string[] = [];
    client.defaults.adapter = async (config) => {
      seen.push(String(config.headers.Authorization));
      throw failure(config, 401);
    };
    await expect(client.get('/thing')).rejects.toBeDefined();
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['undefined', 'Bearer new']);
  });

  it('reports 403 codes and skips refresh for excluded URLs', async () => {
    const onForbidden = jest.fn();
    const refreshSession = jest.fn();
    const client = createApiClient({
      baseURL: 'http://x',
      onRequest: () => undefined,
      refreshSession,
      noRefreshUrls: ['/auth/'],
      onForbidden,
    });
    client.defaults.adapter = async (config) => {
      throw failure(config, config.url === '/auth/login' ? 401 : 403);
    };
    await expect(client.get('/p')).rejects.toBeDefined();
    expect(onForbidden).toHaveBeenCalledWith(expect.anything(), 'FORBIDDEN_X');
    await expect(client.post('/auth/login')).rejects.toBeDefined();
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
