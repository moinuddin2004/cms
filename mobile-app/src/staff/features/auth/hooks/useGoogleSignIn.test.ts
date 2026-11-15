import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getGoogleIdToken, isNativeGoogleAvailable } from '@/core/auth/google';
import { persistSession } from '@/staff/lib/api';

import { fetchGoogleConfig, googleSignIn } from '../api/auth.api';
import {
  GOOGLE_NO_ACCOUNT_MESSAGE,
  googleOutcomeMessage,
  useGoogleSignIn,
} from './useGoogleSignIn';

jest.mock('@/core/auth/google', () => ({
  getGoogleIdToken: jest.fn(),
  isNativeGoogleAvailable: jest.fn(),
}));
jest.mock('@/core/env', () => ({
  env: { apiUrl: 'http://x', googleIosClientId: 'ios' },
}));
jest.mock('@/staff/lib/api', () => ({ persistSession: jest.fn() }));
jest.mock('../api/auth.api', () => ({
  fetchGoogleConfig: jest.fn(),
  googleSignIn: jest.fn(),
}));

const session = { accessToken: 'a' };

async function setup(
  config: { enabled: boolean; clientId: string | null } = { enabled: true, clientId: 'web-id' },
) {
  (isNativeGoogleAvailable as jest.Mock).mockReturnValue(true);
  (fetchGoogleConfig as jest.Mock).mockResolvedValue(config);
  const hook = await renderHook(() => useGoogleSignIn());
  return hook;
}

describe('useGoogleSignIn', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is hidden when the server has Google off', async () => {
    const { result } = await setup({ enabled: false, clientId: null });
    await waitFor(() => expect(fetchGoogleConfig).toHaveBeenCalled());
    expect(result.current.available).toBe(false);
  });

  it('is hidden, and asks nothing, when the native library is missing', async () => {
    (isNativeGoogleAvailable as jest.Mock).mockReturnValue(false);
    const { result } = await renderHook(() => useGoogleSignIn());
    expect(fetchGoogleConfig).not.toHaveBeenCalled();
    expect(result.current.available).toBe(false);
  });

  it('signs in: stores the session', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.available).toBe(true));
    (getGoogleIdToken as jest.Mock).mockResolvedValue('id-token');
    (googleSignIn as jest.Mock).mockResolvedValue({
      outcome: 'signed_in',
      session,
    });
    await act(async () => {
      await result.current.signIn();
    });
    expect(getGoogleIdToken).toHaveBeenCalledWith('web-id', 'ios');
    expect(googleSignIn).toHaveBeenCalledWith('id-token');
    expect(persistSession).toHaveBeenCalledWith(session);
    expect(result.current.error).toBe('');
  });

  it('does nothing when the user cancels the picker', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.available).toBe(true));
    (getGoogleIdToken as jest.Mock).mockResolvedValue(null);
    await act(async () => {
      await result.current.signIn();
    });
    expect(googleSignIn).not.toHaveBeenCalled();
    expect(result.current.error).toBe('');
  });

  it('shows the register/invite message when there is no account', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.available).toBe(true));
    (getGoogleIdToken as jest.Mock).mockResolvedValue('t');
    (googleSignIn as jest.Mock).mockResolvedValue({ outcome: 'no_account' });
    await act(async () => {
      await result.current.signIn();
    });
    expect(result.current.error).toBe(GOOGLE_NO_ACCOUNT_MESSAGE);
    expect(persistSession).not.toHaveBeenCalled();
  });

  it('shows the server message when the sign-in call is refused (403)', async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.available).toBe(true));
    (getGoogleIdToken as jest.Mock).mockResolvedValue('t');
    (googleSignIn as jest.Mock).mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Your clinic does not allow Google sign-in.' },
      },
    });
    await act(async () => {
      await result.current.signIn();
    });
    expect(result.current.error).toBe('Your clinic does not allow Google sign-in.');
    expect(result.current.pending).toBe(false);
  });

  it('maps link_required to the server message', () => {
    expect(
      googleOutcomeMessage({
        outcome: 'link_required',
        message: 'Use your password.',
      }),
    ).toBe('Use your password.');
    expect(googleOutcomeMessage({ outcome: 'signed_in', session } as never)).toBeNull();
  });
});
