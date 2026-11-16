let mockStored: string | null = null;
let mockOnline = true;
let mockRefreshToken: string | null = null;
const mockUnregister = jest.fn();
const mockUnregisterNoSession = jest.fn();

jest.mock('@/core/storage/secure-store', () => ({
  createSecureItem: () => ({
    get: async () => mockStored,
    set: async (v: string) => {
      mockStored = v;
    },
    clear: async () => {
      mockStored = null;
    },
  }),
}));
jest.mock('@/core/network', () => ({ isOnlineNow: () => mockOnline }));
jest.mock('@/core/notifications/push-token', () => ({ getExpoPushToken: jest.fn() }));
jest.mock('@/patient/lib/session', () => ({ getRefreshToken: async () => mockRefreshToken }));
jest.mock('../api/devices.api', () => ({
  registerDevice: jest.fn(),
  unregisterDevice: (...a: unknown[]) => mockUnregister(...a),
  unregisterDeviceWithoutSession: (...a: unknown[]) => mockUnregisterNoSession(...a),
}));

import { finishPendingUnregister, unregisterThisDevice } from './device-registration';

beforeEach(() => {
  mockStored = 'ExponentPushToken[abc]';
  mockOnline = true;
  mockRefreshToken = null;
  mockUnregister.mockReset().mockResolvedValue({ deleted: true });
  mockUnregisterNoSession.mockReset().mockResolvedValue(undefined);
});

describe('offline sign-out cleanup', () => {
  it('an online sign-out unregisters and forgets the token', async () => {
    await unregisterThisDevice();
    expect(mockUnregister).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(mockStored).toBeNull();
  });

  it('an offline sign-out keeps the token, and the next start without a session finishes it', async () => {
    mockOnline = false;
    await unregisterThisDevice();
    expect(mockUnregister).not.toHaveBeenCalled();
    expect(mockStored).toBe('ExponentPushToken[abc]');

    mockOnline = true;
    await finishPendingUnregister();
    expect(mockUnregisterNoSession).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(mockStored).toBeNull();
  });

  it('does nothing while a patient session exists (signing in moves the token)', async () => {
    mockRefreshToken = 'sid:tok';
    await finishPendingUnregister();
    expect(mockUnregisterNoSession).not.toHaveBeenCalled();
    expect(mockStored).toBe('ExponentPushToken[abc]');
  });

  it('keeps the token when the call fails, so the next start retries', async () => {
    mockUnregisterNoSession.mockRejectedValue(new Error('net'));
    await finishPendingUnregister();
    expect(mockStored).toBe('ExponentPushToken[abc]');
  });

  it('does nothing without a stored token', async () => {
    mockStored = null;
    await finishPendingUnregister();
    expect(mockUnregisterNoSession).not.toHaveBeenCalled();
  });
});
