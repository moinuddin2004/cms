import { renderHook } from '@testing-library/react-native';

import { refreshSession } from '@/patient/lib/api';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { useRestorePatientSession } from './useRestorePatientSession';

jest.mock('@/patient/lib/api', () => ({ refreshSession: jest.fn() }));

const refresh = refreshSession as jest.Mock;

async function restore() {
  const { result } = await renderHook(() => useRestorePatientSession());
  await result.current();
}

describe('useRestorePatientSession', () => {
  beforeEach(() => {
    refresh.mockReset();
    usePatientAuthStore.setState({ status: 'restoring' });
  });

  it('stays signedIn when the refresh stored a session', async () => {
    refresh.mockImplementation(async () => {
      usePatientAuthStore.getState().setStatus('signedIn');
      return { accessToken: 'a' };
    });
    await restore();
    expect(usePatientAuthStore.getState().status).toBe('signedIn');
  });

  it('no token / rejected token → signedOut', async () => {
    refresh.mockResolvedValue(null);
    await restore();
    expect(usePatientAuthStore.getState().status).toBe('signedOut');
  });

  it('no connection → unreachable (the session is kept)', async () => {
    refresh.mockRejectedValue(new Error('Network Error'));
    await restore();
    expect(usePatientAuthStore.getState().status).toBe('unreachable');
  });

  it('does nothing when already signed in (no refresh, no splash flash)', async () => {
    usePatientAuthStore.setState({ status: 'signedIn' });
    await restore();
    expect(refresh).not.toHaveBeenCalled();
    expect(usePatientAuthStore.getState().status).toBe('signedIn');
  });
});
