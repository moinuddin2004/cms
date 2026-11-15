import { getExpoPushToken } from '@/core/notifications/push-token';

import { registerDevice, unregisterDevice } from '../api/devices.api';
import { registerThisDevice, unregisterThisDevice } from './device-registration';

jest.mock('@/core/notifications/push-token', () => ({ getExpoPushToken: jest.fn() }));
jest.mock('../api/devices.api', () => ({ registerDevice: jest.fn(), unregisterDevice: jest.fn() }));
let mockOnline = true;
jest.mock('@/core/network', () => ({ isOnlineNow: () => mockOnline }));
jest.mock('expo-device', () => ({ isDevice: true, modelName: 'Pixel 9' }));

// In-memory keychain
const mockSecure = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async (k: string) => mockSecure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockSecure.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockSecure.delete(k)),
}));

const token = getExpoPushToken as jest.Mock;

describe('registerThisDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecure.clear();
  });

  it('posts token, platform, appVersion and the phone model', async () => {
    token.mockResolvedValue('ExponentPushToken[abc]');
    expect(await registerThisDevice()).toBe(true);
    expect(registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        expoPushToken: 'ExponentPushToken[abc]',
        platform: expect.stringMatching(/^(android|ios)$/),
        appVersion: expect.stringMatching(/^.{1,20}$/),
        deviceLabel: 'Pixel 9',
      }),
    );
  });

  it('does nothing without a token (simulator / denied)', async () => {
    token.mockResolvedValue(null);
    expect(await registerThisDevice()).toBe(false);
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('never throws when the API fails', async () => {
    token.mockResolvedValue('ExponentPushToken[abc]');
    (registerDevice as jest.Mock).mockRejectedValueOnce(new Error('500'));
    expect(await registerThisDevice()).toBe(false);
  });
});

describe('unregisterThisDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecure.clear();
  });

  it('deletes the registered token, then forgets it', async () => {
    token.mockResolvedValue('ExponentPushToken[abc]');
    await registerThisDevice();
    await unregisterThisDevice();
    expect(unregisterDevice).toHaveBeenCalledWith('ExponentPushToken[abc]');
    await unregisterThisDevice();
    expect(unregisterDevice).toHaveBeenCalledTimes(1);
  });

  it('skips the call offline and keeps the token for the next sign-out', async () => {
    token.mockResolvedValue('ExponentPushToken[abc]');
    await registerThisDevice();
    mockOnline = false;
    await unregisterThisDevice();
    expect(unregisterDevice).not.toHaveBeenCalled();
    mockOnline = true;
    await unregisterThisDevice();
    expect(unregisterDevice).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when nothing was registered', async () => {
    await unregisterThisDevice();
    expect(unregisterDevice).not.toHaveBeenCalled();
  });

  it('keeps the token for a retry when the API is unreachable, and does not throw', async () => {
    token.mockResolvedValue('ExponentPushToken[abc]');
    await registerThisDevice();
    (unregisterDevice as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(unregisterThisDevice()).resolves.toBeUndefined();
    await unregisterThisDevice();
    expect(unregisterDevice).toHaveBeenCalledTimes(2);
  });
});
