import { renderHook } from '@testing-library/react-native';

import { refreshSession } from '@/staff/lib/api';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { useRestoreStaffSession } from './useRestoreStaffSession';

jest.mock('@/staff/lib/api', () => ({ refreshSession: jest.fn() }));

const refresh = refreshSession as jest.Mock;

async function restore() {
  const { result } = await renderHook(() => useRestoreStaffSession());
  await result.current();
}

describe('useRestoreStaffSession', () => {
  beforeEach(() => {
    refresh.mockReset();
    useStaffAuthStore.setState({ status: 'restoring' });
  });

  it('skips the restore when the session is already signedIn (M0-04 review)', async () => {
    useStaffAuthStore.setState({ status: 'signedIn' });
    await restore();
    expect(refresh).not.toHaveBeenCalled();
    expect(useStaffAuthStore.getState().status).toBe('signedIn');
  });

  it('restores when signed out / unreachable', async () => {
    refresh.mockResolvedValue(null);
    await restore();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useStaffAuthStore.getState().status).toBe('signedOut');
  });

  it('no connection → unreachable', async () => {
    refresh.mockRejectedValue(new Error('Network Error'));
    await restore();
    expect(useStaffAuthStore.getState().status).toBe('unreachable');
  });
});
