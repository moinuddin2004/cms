import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { toast } from 'sonner-native';

import { useWalkInForm } from './useWalkInForm';

// The patients barrel pulls in whole pages; the schema only needs this validator.
jest.mock('@/staff/features/patients', () =>
  jest.requireActual('../../patients/schemas/quick-register.schema'),
);

jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));

const mockRegister = jest.fn();
jest.mock('../api/queue.api', () => ({
  registerWalkIn: (...a: unknown[]) => mockRegister(...a),
}));

function httpError(status: number, code: string, extra: object = {}) {
  const response = {
    status,
    data: { error: { code, ...extra } },
    headers: {},
    statusText: '',
    config: { headers: new AxiosHeaders() },
  } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, response);
}

const arrival = { entry: { id: 'e1' }, token: 'A-015', sessionId: 's', doctorId: 'doc-1' };

async function setup(onCreated = jest.fn()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useWalkInForm('doc-1', 'existing', onCreated), { wrapper });
  return { hook, onCreated, client };
}

async function fillAndSubmit(hook: Awaited<ReturnType<typeof setup>>['hook']) {
  await act(async () => {
    const { form } = hook.result.current;
    form.setFieldValue('patientId', 'p1');
    form.setFieldValue('patientLabel', 'Hina');
    await form.handleSubmit();
  });
}

describe('useWalkInForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not send an invalid form', async () => {
    const { hook } = await setup();
    await act(async () => {
      await hook.result.current.form.handleSubmit();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('ACTIVE_WITH_OTHER_DOCTOR opens the dialog (no toast); confirming resends with force and a new key', async () => {
    mockRegister
      .mockRejectedValueOnce(httpError(409, 'ACTIVE_WITH_OTHER_DOCTOR'))
      .mockResolvedValueOnce(arrival);
    const { hook, onCreated } = await setup();

    await fillAndSubmit(hook);
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister.mock.calls[0][0]).toEqual({ doctorId: 'doc-1', patientId: 'p1' });
    expect(hook.result.current.forceOpen).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();

    await act(async () => {
      await hook.result.current.confirmForce();
    });
    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockRegister.mock.calls[1][0]).toEqual({ doctorId: 'doc-1', patientId: 'p1', force: true });
    // The body changed, so it is a new intent: a new Idempotency-Key.
    const firstKey = mockRegister.mock.calls[0][1].idempotencyKey;
    const secondKey = mockRegister.mock.calls[1][1].idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).not.toBe(firstKey);
    expect(hook.result.current.forceOpen).toBe(false);
    expect(onCreated).toHaveBeenCalledWith(arrival, expect.objectContaining({ patientId: 'p1' }));
  });

  it('names the other doctor from the error payload when the server sends it', async () => {
    mockRegister.mockRejectedValueOnce(
      httpError(409, 'ACTIVE_WITH_OTHER_DOCTOR', {
        entries: [{ entryId: 'x', token: 'B-004', doctorName: 'Dr Imran', status: 'waiting' }],
      }),
    );
    const { hook } = await setup();
    await fillAndSubmit(hook);
    expect(hook.result.current.forceDoctorName).toBe('Dr Imran');
  });

  it('has no doctor name when the payload carries none', async () => {
    mockRegister.mockRejectedValueOnce(httpError(409, 'ACTIVE_WITH_OTHER_DOCTOR'));
    const { hook } = await setup();
    await fillAndSubmit(hook);
    expect(hook.result.current.forceOpen).toBe(true);
    expect(hook.result.current.forceDoctorName).toBeNull();
  });

  it('starts in the given mode (new patient for roles that cannot search patients)', async () => {
    const client = new QueryClient();
    const { result } = await renderHook(() => useWalkInForm('doc-1', 'new', jest.fn()), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.form.state.values.mode).toBe('new');
  });

  it('dismissing the dialog sends nothing more', async () => {
    mockRegister.mockRejectedValueOnce(httpError(409, 'ACTIVE_WITH_OTHER_DOCTOR'));
    const { hook } = await setup();
    await fillAndSubmit(hook);
    await act(async () => hook.result.current.dismissForce());
    expect(hook.result.current.forceOpen).toBe(false);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('another error toasts, keeps the form values and closes nothing', async () => {
    mockRegister.mockRejectedValueOnce(httpError(404, 'NOT_FOUND'));
    const { hook, onCreated } = await setup();
    await fillAndSubmit(hook);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(hook.result.current.forceOpen).toBe(false);
    expect(hook.result.current.form.state.values.patientId).toBe('p1');
    expect(onCreated).not.toHaveBeenCalled();
  });
});
