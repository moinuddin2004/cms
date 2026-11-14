import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { patientKeys } from '../api/patients.keys';
import { useQuickRegisterForm } from './useQuickRegisterForm';

const mockCreate = jest.fn();
jest.mock('../api/patients.api', () => ({
  createPatient: (...a: unknown[]) => mockCreate(...a),
}));
const mockToastError = jest.fn();
jest.mock('sonner-native', () => ({ toast: { error: (...a: unknown[]) => mockToastError(...a) } }));

async function setup(onCreated?: (p: unknown) => void) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useQuickRegisterForm(onCreated), { wrapper });
  return { client, result: hook.result };
}

beforeEach(() => {
  mockCreate.mockReset();
  mockToastError.mockReset();
});

describe('useQuickRegisterForm', () => {
  it('blocks submit with validation errors and never calls the API', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.current.form.state.canSubmit).toBe(false);
  });

  it('a minor needs guardian name and phone', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.form.setFieldValue('fullName', 'Sara');
      result.current.form.setFieldValue('phone', '03001234567');
      result.current.form.setFieldValue('isMinor', true);
      await result.current.form.handleSubmit();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('submits cleaned values, invalidates patient lists, reports the new patient', async () => {
    mockCreate.mockResolvedValue({ id: 'new-1' });
    const onCreated = jest.fn();
    const { result, client } = await setup(onCreated);
    client.setQueryData(patientKeys.list('o1', 'l1', {}), { pages: [] });
    client.setQueryData(patientKeys.detail('o1', 'l1', 'x'), { id: 'x' });

    await act(async () => {
      result.current.form.setFieldValue('fullName', '  Sara Khan ');
      result.current.form.setFieldValue('phone', ' 0300 1234567 ');
      await result.current.form.handleSubmit();
    });

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'new-1' }));
    expect(mockCreate).toHaveBeenCalledWith({
      fullName: 'Sara Khan',
      phone: '0300 1234567',
      dob: undefined,
      gender: undefined,
      isMinor: false,
    });
    expect(client.getQueryState(patientKeys.list('o1', 'l1', {}))?.isInvalidated).toBe(true);
    expect(client.getQueryState(patientKeys.detail('o1', 'l1', 'x'))?.isInvalidated).toBe(false);
    expect(result.current.form.state.values.fullName).toBe('');
  });

  it('keeps the values and toasts when the API fails', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));
    const onCreated = jest.fn();
    const { result } = await setup(onCreated);
    await act(async () => {
      result.current.form.setFieldValue('fullName', 'Sara');
      result.current.form.setFieldValue('phone', '03001234567');
      await result.current.form.handleSubmit();
    });
    expect(onCreated).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
    expect(result.current.form.state.values.fullName).toBe('Sara');
  });

  it('tracks dirty state', async () => {
    const { result } = await setup();
    expect(result.current.isDirty).toBe(false);
    await act(async () => {
      result.current.form.setFieldValue('fullName', 'S');
    });
    expect(result.current.isDirty).toBe(true);
  });
});
