import { act, renderHook } from '@testing-library/react-native';
import { AxiosError } from 'axios';

import { refreshSession } from '@/staff/lib/api';
import { loadOfflineHint } from '@/staff/lib/offline-hint';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { useRestoreStaffSession } from './useRestoreStaffSession';

jest.mock('@/staff/lib/api', () => ({ refreshSession: jest.fn() }));
jest.mock('@/staff/lib/offline-hint', () => ({ loadOfflineHint: jest.fn() }));

const HINT = { userId: 'u1', orgId: 'o1', locationId: 'l1' };

const httpError = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    data: {},
    config: {} as never,
  });

async function restore() {
  const { result } = await renderHook(() => useRestoreStaffSession());
  await act(async () => {
    await result.current();
  });
}

describe('useRestoreStaffSession offline hint (M1-06b)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStaffAuthStore.getState().clearAuth();
    (loadOfflineHint as jest.Mock).mockResolvedValue(HINT);
  });

  it('offers saved data after a NETWORK error', async () => {
    (refreshSession as jest.Mock).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    await restore();
    const s = useStaffAuthStore.getState();
    expect(s.status).toBe('unreachable');
    expect(s.offlineHint).toEqual(HINT);
  });

  it('never offers it after a rejected session (401/403 → signed out)', async () => {
    (refreshSession as jest.Mock).mockResolvedValue(null);
    await restore();
    const s = useStaffAuthStore.getState();
    expect(s.status).toBe('signedOut');
    expect(s.offlineHint).toBeNull();
    expect(loadOfflineHint).not.toHaveBeenCalled();
  });

  it('does not offer it when the server answered with an error (5xx)', async () => {
    (refreshSession as jest.Mock).mockRejectedValue(httpError(503));
    await restore();
    const s = useStaffAuthStore.getState();
    expect(s.status).toBe('unreachable');
    expect(s.offlineHint).toBeNull();
    expect(loadOfflineHint).not.toHaveBeenCalled();
  });

  it('a later successful restore clears a stale hint', async () => {
    useStaffAuthStore.getState().setOfflineHint(HINT);
    (refreshSession as jest.Mock).mockResolvedValue({ ok: true });
    await restore();
    expect(useStaffAuthStore.getState().offlineHint).toBeNull();
  });

  it('retries the refresh when open on saved data, but not on a normal signed-in session', async () => {
    (refreshSession as jest.Mock).mockResolvedValue({ ok: true });
    useStaffAuthStore.setState({ status: 'signedIn', offlineSnapshot: false });
    await restore();
    expect(refreshSession).not.toHaveBeenCalled();
    useStaffAuthStore.getState().openSavedData(HINT);
    await restore();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('openSavedData opens the saved identity read-only without a token', async () => {
    useStaffAuthStore.getState().openSavedData(HINT);
    const s = useStaffAuthStore.getState();
    expect(s.status).toBe('signedIn');
    expect(s.offlineSnapshot).toBe(true);
    expect(s.accessToken).toBeNull();
    expect([s.user?.uuid, s.activeOrganizationId, s.activeLocationId]).toEqual(['u1', 'o1', 'l1']);
    s.clearAuth();
    expect(useStaffAuthStore.getState().offlineSnapshot).toBe(false);
  });
});
