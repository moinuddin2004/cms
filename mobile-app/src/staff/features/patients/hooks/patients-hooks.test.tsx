import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import type { PatientTeethChart, PrescriptionListItem } from '../types/patients.types';
import { useCheckPhone } from './useCheckPhone';
import { useLatestTeethChart } from './useLatestTeethChart';
import { usePatientHistory } from './usePatientHistory';
import { usePatientPrescriptions } from './usePatientPrescriptions';
import { usePatientsInfinite } from './usePatientsInfinite';
import { usePatientVitals } from './usePatientVitals';

const mockApi = {
  fetchPatients: jest.fn(),
  fetchPatientHistory: jest.fn(),
  fetchPatientVitals: jest.fn(),
  fetchPatientPrescriptions: jest.fn(),
  fetchPatientTeethCharts: jest.fn(),
  checkPatientPhone: jest.fn(),
  fetchPatient: jest.fn(),
  createPatient: jest.fn(),
};
jest.mock('../api/patients.api', () => ({
  fetchPatients: (...a: unknown[]) => mockApi.fetchPatients(...a),
  fetchPatientHistory: (...a: unknown[]) => mockApi.fetchPatientHistory(...a),
  fetchPatientVitals: (...a: unknown[]) => mockApi.fetchPatientVitals(...a),
  fetchPatientPrescriptions: (...a: unknown[]) => mockApi.fetchPatientPrescriptions(...a),
  fetchPatientTeethCharts: (...a: unknown[]) => mockApi.fetchPatientTeethCharts(...a),
  checkPatientPhone: (...a: unknown[]) => mockApi.checkPatientPhone(...a),
  fetchPatient: (...a: unknown[]) => mockApi.fetchPatient(...a),
  createPatient: (...a: unknown[]) => mockApi.createPatient(...a),
}));

let mockPerms = new Set<string>();
let mockFeatures = new Set<string>();
jest.mock('@/staff/features/access', () => ({
  useAccess: () => ({
    can: (p: string) => mockPerms.has(p),
    hasFeature: (f: string) => mockFeatures.has(f),
  }),
}));

function wrapperFor(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  Object.values(mockApi).forEach((m) => m.mockReset());
  mockPerms = new Set();
  mockFeatures = new Set();
  useStaffAuthStore.setState({ activeOrganizationId: 'o1', activeLocationId: 'l1' });
});

const page = (n: number, totalPages: number) => ({
  data: [{ id: `p${n}` }],
  total: 40,
  page: n,
  limit: 20,
  totalPages,
});

describe('usePatientsInfinite', () => {
  it('pages 20 at a time while page < totalPages', async () => {
    mockApi.fetchPatients.mockImplementation(async (q: { page: number }) => page(q.page, 2));
    const { result } = await renderHook(() => usePatientsInfinite({}), {
      wrapper: wrapperFor(newClient()),
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(mockApi.fetchPatients).toHaveBeenLastCalledWith({ limit: 20, page: 1 });
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(mockApi.fetchPatients).toHaveBeenLastCalledWith({ limit: 20, page: 2 });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('drops a search under 2 characters and trims longer ones', async () => {
    mockApi.fetchPatients.mockResolvedValue(page(1, 1));
    const client = newClient();
    const { rerender } = await renderHook(
      (p: { search: string }) => usePatientsInfinite({ search: p.search }),
      { wrapper: wrapperFor(client), initialProps: { search: ' a ' } },
    );
    await waitFor(() => expect(mockApi.fetchPatients).toHaveBeenCalledTimes(1));
    expect(mockApi.fetchPatients.mock.calls[0][0]).toEqual({ limit: 20, page: 1 });

    await rerender({ search: ' ali ' });
    await waitFor(() => expect(mockApi.fetchPatients).toHaveBeenCalledTimes(2));
    expect(mockApi.fetchPatients.mock.calls[1][0]).toEqual({ limit: 20, page: 1, search: 'ali' });
  });

  it('never sends a false boolean filter', async () => {
    mockApi.fetchPatients.mockResolvedValue(page(1, 1));
    const filters = { isMinor: false, isBlacklisted: true } as unknown as Parameters<
      typeof usePatientsInfinite
    >[0];
    await renderHook(() => usePatientsInfinite(filters), { wrapper: wrapperFor(newClient()) });
    await waitFor(() => expect(mockApi.fetchPatients).toHaveBeenCalled());
    expect(mockApi.fetchPatients.mock.calls[0][0]).toEqual({
      limit: 20,
      page: 1,
      isBlacklisted: true,
    });
  });

  it('stays idle without an active location', async () => {
    useStaffAuthStore.setState({ activeLocationId: null });
    await renderHook(() => usePatientsInfinite({}), { wrapper: wrapperFor(newClient()) });
    expect(mockApi.fetchPatients).not.toHaveBeenCalled();
  });
});

describe('gated hooks', () => {
  it('stay idle and report allowed=false without permission', async () => {
    const wrapper = wrapperFor(newClient());
    const h = await renderHook(() => usePatientHistory('p1'), { wrapper });
    const v = await renderHook(() => usePatientVitals('p1'), { wrapper });
    const rx = await renderHook(() => usePatientPrescriptions('p1'), { wrapper });
    const t = await renderHook(() => useLatestTeethChart('p1'), { wrapper });
    for (const r of [h, v, rx, t]) {
      expect(r.result.current.allowed).toBe(false);
      expect(r.result.current.query.fetchStatus).toBe('idle');
      expect(r.result.current.query.isError).toBe(false);
    }
    expect(mockApi.fetchPatientHistory).not.toHaveBeenCalled();
    expect(mockApi.fetchPatientVitals).not.toHaveBeenCalled();
    expect(mockApi.fetchPatientPrescriptions).not.toHaveBeenCalled();
    expect(mockApi.fetchPatientTeethCharts).not.toHaveBeenCalled();
  });

  it('clinical permission without the feature still blocks prescriptions and chart', async () => {
    mockPerms = new Set(['patients.clinical.view']);
    const wrapper = wrapperFor(newClient());
    mockApi.fetchPatientHistory.mockResolvedValue({ appointments: [] });
    const h = await renderHook(() => usePatientHistory('p1'), { wrapper });
    const rx = await renderHook(() => usePatientPrescriptions('p1'), { wrapper });
    const t = await renderHook(() => useLatestTeethChart('p1'), { wrapper });
    await waitFor(() => expect(h.result.current.query.isSuccess).toBe(true));
    expect(h.result.current.allowed).toBe(true);
    expect(rx.result.current.allowed).toBe(false);
    expect(t.result.current.allowed).toBe(false);
    expect(mockApi.fetchPatientPrescriptions).not.toHaveBeenCalled();
    expect(mockApi.fetchPatientTeethCharts).not.toHaveBeenCalled();
  });

  it('prescriptions: permission + feature run, finalized/amended before drafts', async () => {
    mockPerms = new Set(['patients.clinical.view']);
    mockFeatures = new Set(['patients.prescriptions']);
    const rx = (id: string, status: string) => ({ id, status }) as PrescriptionListItem;
    mockApi.fetchPatientPrescriptions.mockResolvedValue({
      data: [rx('a', 'DRAFT'), rx('b', 'FINALIZED'), rx('c', 'DRAFT'), rx('d', 'AMENDED')],
      total: 4,
    });
    const { result } = await renderHook(() => usePatientPrescriptions('p1'), {
      wrapper: wrapperFor(newClient()),
    });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.query.data?.data.map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(mockApi.fetchPatientPrescriptions).toHaveBeenCalledWith('p1', 1);
  });

  it('teeth chart: returns the newest chart, null when none', async () => {
    mockPerms = new Set(['patients.clinical.view']);
    mockFeatures = new Set(['patients.teeth_chart']);
    const chart = (id: string, recordedAt: string) => ({ id, recordedAt }) as PatientTeethChart;
    mockApi.fetchPatientTeethCharts.mockResolvedValue([
      chart('old', '2026-01-01T00:00:00.000Z'),
      chart('new', '2026-06-01T00:00:00.000Z'),
    ]);
    const a = await renderHook(() => useLatestTeethChart('p1'), { wrapper: wrapperFor(newClient()) });
    await waitFor(() => expect(a.result.current.query.isSuccess).toBe(true));
    expect(a.result.current.query.data?.id).toBe('new');

    mockApi.fetchPatientTeethCharts.mockResolvedValue([]);
    const b = await renderHook(() => useLatestTeethChart('p1'), { wrapper: wrapperFor(newClient()) });
    await waitFor(() => expect(b.result.current.query.isSuccess).toBe(true));
    expect(b.result.current.query.data).toBeNull();
  });
});

describe('useCheckPhone', () => {
  it('is idle for an invalid phone and runs for a valid one', async () => {
    mockApi.checkPatientPhone.mockResolvedValue({ exists: true });
    const { result, rerender } = await renderHook((p: { phone: string }) => useCheckPhone(p.phone), {
      wrapper: wrapperFor(newClient()),
      initialProps: { phone: '0300' },
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.checkPatientPhone).not.toHaveBeenCalled();

    await rerender({ phone: ' 0300 1234567 ' });
    await waitFor(() => expect(result.current.data).toEqual({ exists: true }));
    expect(mockApi.checkPatientPhone).toHaveBeenCalledWith('0300 1234567', undefined);
  });
});
