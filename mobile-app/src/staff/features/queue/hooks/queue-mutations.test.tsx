import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { toast } from 'sonner-native';

import { queueKeys } from '../api/queue.keys';
import { useCheckIn } from './useArrivalMutations';
import { useCancelEntry, useCompleteEntry, useRecallEntry, useSkipEntry } from './useEntryMutations';
import { useCallNext, useOpenSession, useStartSession } from './useSessionMutations';

jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));

const mockStartSession = jest.fn();
const mockCallNext = jest.fn();
const mockOpenSession = jest.fn();
const mockSkipEntry = jest.fn();
const mockCompleteEntry = jest.fn();
const mockRecallEntry = jest.fn();
const mockCancelEntry = jest.fn();
const mockCheckIn = jest.fn();
jest.mock('../api/queue.api', () => ({
  startSession: (...a: unknown[]) => mockStartSession(...a),
  callNext: (...a: unknown[]) => mockCallNext(...a),
  openSession: (...a: unknown[]) => mockOpenSession(...a),
  skipEntry: (...a: unknown[]) => mockSkipEntry(...a),
  completeEntry: (...a: unknown[]) => mockCompleteEntry(...a),
  recallEntry: (...a: unknown[]) => mockRecallEntry(...a),
  cancelEntry: (...a: unknown[]) => mockCancelEntry(...a),
  checkInAppointment: (...a: unknown[]) => mockCheckIn(...a),
}));

function httpError(status: number, code: string) {
  const response = {
    status,
    data: { error: { code } },
    headers: {},
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, response);
}

const clients: QueryClient[] = [];

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  clients.push(client);
  const spy = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, spy, wrapper };
}

/** Run one mutate() to completion (including retry delays); never throws. */
async function run<V>(mutateAsync: (v: V) => Promise<unknown>, vars: V) {
  await act(async () => {
    const p = mutateAsync(vars).catch(() => undefined);
    await jest.runAllTimersAsync();
    await p;
  });
}

describe('queue mutation hooks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(async () => {
    await cleanup();
    clients.splice(0).forEach((c) => c.clear());
    jest.useRealTimers();
  });

  it('sends one idempotency key and reuses it on a 503 LOCK_TIMEOUT retry', async () => {
    mockStartSession
      .mockRejectedValueOnce(httpError(503, 'LOCK_TIMEOUT'))
      .mockResolvedValueOnce({ session: { id: 's1' } });
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useStartSession(), { wrapper });

    await run(result.current.mutateAsync, { sessionId: 's1' });

    expect(mockStartSession).toHaveBeenCalledTimes(2);
    const keys = mockStartSession.mock.calls.map((c) => c[1].idempotencyKey as string);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('toasts "Busy, please try again." only after the 3 retries gave up', async () => {
    mockStartSession.mockRejectedValue(httpError(503, 'LOCK_TIMEOUT'));
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useStartSession(), { wrapper });

    await run(result.current.mutateAsync, { sessionId: 's1' });

    expect(mockStartSession).toHaveBeenCalledTimes(4);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Busy, please try again.');
  });

  it.each(['ACTIVE_WITH_OTHER_DOCTOR', 'LATE_LIMIT_EXCEEDED'])(
    '%s opens the caller dialog: no toast, the caller onError runs',
    async (code) => {
      mockCheckIn.mockRejectedValue(httpError(409, code));
      const { spy, wrapper } = makeWrapper();
      const { result } = await renderHook(() => useCheckIn(), { wrapper });
      const callerOnError = jest.fn();

      await act(async () => {
        result.current.mutate({ appointmentId: 'a1' }, { onError: callerOnError });
        await jest.runAllTimersAsync();
      });

      expect(toast.error).not.toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
      expect(callerOnError).toHaveBeenCalledTimes(1);
    },
  );

  it('uses a new key for the next tap', async () => {
    mockStartSession.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useStartSession(), { wrapper });

    await run(result.current.mutateAsync, { sessionId: 's1' });
    await run(result.current.mutateAsync, { sessionId: 's1' });

    expect(mockStartSession.mock.calls[0][1].idempotencyKey).not.toBe(
      mockStartSession.mock.calls[1][1].idempotencyKey,
    );
  });

  it('passes entry.version as ifMatch, with the key', async () => {
    mockSkipEntry.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useSkipEntry(), { wrapper });

    await run(result.current.mutateAsync, { entryId: 'e1', version: 7 });

    const [vars, opts] = mockSkipEntry.mock.calls[0];
    expect(vars.entryId).toBe('e1');
    expect(opts).toEqual({ idempotencyKey: expect.any(String), ifMatch: 7 });
  });

  it('forwards extra variables (cancel reason) next to the version', async () => {
    mockCancelEntry.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useCancelEntry(), { wrapper });

    await run(result.current.mutateAsync, { entryId: 'e1', version: 2, reason: 'left' });

    expect(mockCancelEntry.mock.calls[0][0]).toMatchObject({ entryId: 'e1', reason: 'left' });
    expect(mockCancelEntry.mock.calls[0][1].ifMatch).toBe(2);
  });

  it('recall sends a key but no If-Match (the server does not version-check it)', async () => {
    mockRecallEntry.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useRecallEntry(), { wrapper });

    await run(result.current.mutateAsync, { entryId: 'e1' });

    expect(mockRecallEntry.mock.calls[0][1]).toEqual({ idempotencyKey: expect.any(String) });
  });

  it('check-in passes the appointment and the key', async () => {
    mockCheckIn.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useCheckIn(), { wrapper });

    await run(result.current.mutateAsync, { appointmentId: 'a1' });

    expect(mockCheckIn.mock.calls[0][0]).toEqual({ appointmentId: 'a1' });
    expect(mockCheckIn.mock.calls[0][1].idempotencyKey).toEqual(expect.any(String));
  });

  it('success invalidates the queue prefix', async () => {
    mockCompleteEntry.mockResolvedValue({});
    const { spy, wrapper } = makeWrapper();
    const { result } = await renderHook(() => useCompleteEntry(), { wrapper });

    await run(result.current.mutateAsync, { entryId: 'e1', version: 1 });

    expect(spy).toHaveBeenCalledWith({ queryKey: queueKeys.all });
  });

  it('VERSION_CONFLICT toasts the status-changed copy and invalidates', async () => {
    mockCompleteEntry.mockRejectedValue(httpError(409, 'VERSION_CONFLICT'));
    const { spy, wrapper } = makeWrapper();
    const { result } = await renderHook(() => useCompleteEntry(), { wrapper });

    await run(result.current.mutateAsync, { entryId: 'e1', version: 1 });

    expect(toast.error).toHaveBeenCalledWith(
      "This patient's status changed. Please check and try again.",
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: queueKeys.all });
  });

  it('an error that does not make the screen stale toasts without invalidating', async () => {
    mockCompleteEntry.mockRejectedValue(httpError(422, 'DOCTOR_BUSY'));
    const { spy, wrapper } = makeWrapper();
    const { result } = await renderHook(() => useCompleteEntry(), { wrapper });

    await run(result.current.mutateAsync, { entryId: 'e1', version: 1 });

    expect(toast.error).toHaveBeenCalledWith('Finish the current patient first.');
    expect(spy).not.toHaveBeenCalled();
  });

  it('NO_ELIGIBLE_PATIENT shows "No one is waiting" as a plain toast, not an error', async () => {
    mockCallNext.mockResolvedValue({ entry: null, reason: 'NO_ELIGIBLE_PATIENT', eventSeq: 4 });
    const { spy, wrapper } = makeWrapper();
    const { result } = await renderHook(() => useCallNext(), { wrapper });

    await run(result.current.mutateAsync, { sessionId: 's1' });

    expect(toast).toHaveBeenCalledWith('No one is waiting');
    expect(toast.error).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('call next with a patient shows no toast', async () => {
    mockCallNext.mockResolvedValue({ entry: { id: 'e1' }, reason: 'SMART_ORDER', eventSeq: 4 });
    const { wrapper } = makeWrapper();
    const { result } = await renderHook(() => useCallNext(), { wrapper });

    await run(result.current.mutateAsync, { sessionId: 's1' });

    expect(toast).not.toHaveBeenCalled();
  });

  it('openSession is a plain mutation: no retry on a failure, invalidates on success', async () => {
    mockOpenSession.mockRejectedValueOnce(httpError(503, 'LOCK_TIMEOUT'));
    const { spy, wrapper } = makeWrapper();
    const { result } = await renderHook(() => useOpenSession(), { wrapper });

    await run(result.current.mutateAsync, { doctorId: 'd1' });
    expect(mockOpenSession).toHaveBeenCalledTimes(1);
    expect(mockOpenSession).toHaveBeenCalledWith({ doctorId: 'd1' });
    expect(toast.error).toHaveBeenCalledWith('Busy, please try again.');

    mockOpenSession.mockResolvedValueOnce({});
    await run(result.current.mutateAsync, { doctorId: 'd1' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queueKeys.all });
  });
});
