import { getGoogleIdToken, isNativeGoogleAvailable } from './google';

const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn().mockResolvedValue(true),
  signIn: jest.fn(),
  signOut: jest.fn().mockResolvedValue(null),
};

jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: mockGoogleSignin }), {
  virtual: true,
});

describe('google adapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is available when the library loads', () => {
    expect(isNativeGoogleAvailable()).toBe(true);
  });

  it('configures with the web client id and returns the ID token', async () => {
    mockGoogleSignin.signIn.mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 'tok' },
    });
    await expect(getGoogleIdToken('web-id', 'ios-id')).resolves.toBe('tok');
    expect(mockGoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: 'web-id',
      iosClientId: 'ios-id',
    });
  });

  it('returns null when the user cancels', async () => {
    mockGoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled' });
    await expect(getGoogleIdToken('web-id')).resolves.toBeNull();
  });

  it('throws when Google returns no token', async () => {
    mockGoogleSignin.signIn.mockResolvedValueOnce({
      type: 'success',
      data: { idToken: null },
    });
    await expect(getGoogleIdToken('web-id')).rejects.toThrow('ID token');
  });

  it('still signs in when clearing the previous account fails', async () => {
    mockGoogleSignin.signOut.mockRejectedValueOnce(new Error('x'));
    mockGoogleSignin.signIn.mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 't2' },
    });
    await expect(getGoogleIdToken('web-id')).resolves.toBe('t2');
  });
});
