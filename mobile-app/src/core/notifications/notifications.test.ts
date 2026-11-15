import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { foregroundBehavior } from './foreground';
import { getPermissionState, requestPermission, toPermissionState } from './permissions';
import { parsePushData } from './push-data';
import { getExpoPushToken } from './push-token';
import { subscribeToPushTaps } from './tap-events';

jest.mock('expo-device', () => ({ isDevice: true, modelName: 'Pixel 9' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } }, easConfig: null },
}));

const N = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => jest.clearAllMocks());

describe('permission state', () => {
  it('maps the OS answer', () => {
    expect(toPermissionState({ granted: true, canAskAgain: true, status: 'granted' })).toBe('granted');
    expect(toPermissionState({ granted: false, canAskAgain: true, status: 'undetermined' })).toBe(
      'undetermined',
    );
    expect(toPermissionState({ granted: false, canAskAgain: false, status: 'denied' })).toBe('denied');
  });

  it('reads without prompting and treats a failure as denied', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    } as never);
    expect(await getPermissionState()).toBe('undetermined');
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();

    N.getPermissionsAsync.mockRejectedValueOnce(new Error('boom'));
    expect(await getPermissionState()).toBe('denied');
  });

  it('requestPermission shows the prompt and returns the new state', async () => {
    N.requestPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
      status: 'denied',
    } as never);
    expect(await requestPermission()).toBe('denied');
    expect(N.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('getExpoPushToken', () => {
  beforeEach(() => {
    (Device as { isDevice: boolean }).isDevice = true;
  });

  it('returns the token with the EAS project id', async () => {
    expect(await getExpoPushToken()).toBe('ExponentPushToken[test]');
    expect(N.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('is null on a simulator', async () => {
    (Device as { isDevice: boolean }).isDevice = false;
    expect(await getExpoPushToken()).toBeNull();
  });

  it('is null when permission is not granted, without prompting', async () => {
    N.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      status: 'undetermined',
    } as never);
    expect(await getExpoPushToken()).toBeNull();
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('is null when Expo cannot be reached', async () => {
    N.getExpoPushTokenAsync.mockRejectedValueOnce(new Error('offline'));
    expect(await getExpoPushToken()).toBeNull();
  });
});

describe('parsePushData', () => {
  it('accepts a staff payload and nulls the rest', () => {
    expect(
      parsePushData({ space: 'staff', type: 'queue.checked_in', route: '/queue/doctor', extra: 1 }),
    ).toEqual({
      space: 'staff',
      type: 'queue.checked_in',
      route: '/queue/doctor',
      organizationId: null,
      locationId: null,
      entityId: null,
    });
  });

  it.each([[null], [undefined], ['x'], [{}], [{ space: 'admin' }]])('rejects %p', (raw) => {
    expect(parsePushData(raw)).toBeNull();
  });
});

describe('foregroundBehavior', () => {
  it('shows a banner and sound for queue events only', () => {
    expect(foregroundBehavior({ space: 'staff', type: 'queue.checked_in' })).toMatchObject({
      shouldShowBanner: true,
      shouldPlaySound: true,
    });
    expect(foregroundBehavior({ space: 'staff', type: 'lab.ready' })).toMatchObject({
      shouldShowBanner: false,
      shouldPlaySound: false,
      shouldShowList: true,
    });
    expect(foregroundBehavior(undefined)).toMatchObject({ shouldShowBanner: false });
  });
});

describe('subscribeToPushTaps', () => {
  const response = (id: string, route: string, action = Notifications.DEFAULT_ACTION_IDENTIFIER) =>
    ({
      actionIdentifier: action,
      notification: {
        request: { identifier: id, content: { data: { space: 'staff', route } } },
      },
    }) as never;

  it('warm: handles a tap from the listener and stops after unsubscribe', () => {
    let listener: (r: never) => void = () => undefined;
    const remove = jest.fn();
    N.addNotificationResponseReceivedListener.mockImplementationOnce(((l: never) => {
      listener = l;
      return { remove };
    }) as never);
    const onTap = jest.fn();
    const stop = subscribeToPushTaps(onTap);

    listener(response('a', '/queue/doctor'));
    expect(onTap).toHaveBeenCalledWith(expect.objectContaining({ route: '/queue/doctor' }));

    stop();
    expect(remove).toHaveBeenCalled();
    listener(response('b', '/queue'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('cold: handles the launching tap once and clears it', async () => {
    N.getLastNotificationResponseAsync.mockResolvedValueOnce(response('c', '/queue') as never);
    const onTap = jest.fn();
    subscribeToPushTaps(onTap);
    await new Promise((r) => setImmediate(r));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(N.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('delivers one notification once even if listener and cold start both report it', async () => {
    let listener: (r: never) => void = () => undefined;
    N.addNotificationResponseReceivedListener.mockImplementationOnce(((l: never) => {
      listener = l;
      return { remove: jest.fn() };
    }) as never);
    N.getLastNotificationResponseAsync.mockResolvedValueOnce(response('d', '/queue') as never);
    const onTap = jest.fn();
    subscribeToPushTaps(onTap);
    listener(response('d', '/queue'));
    await new Promise((r) => setImmediate(r));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('ignores action buttons and foreign payloads', async () => {
    let listener: (r: never) => void = () => undefined;
    N.addNotificationResponseReceivedListener.mockImplementationOnce(((l: never) => {
      listener = l;
      return { remove: jest.fn() };
    }) as never);
    const onTap = jest.fn();
    subscribeToPushTaps(onTap);
    listener(response('e', '/queue', 'custom-action'));
    listener({
      actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
      notification: { request: { identifier: 'f', content: { data: { hello: 1 } } } },
    } as never);
    expect(onTap).not.toHaveBeenCalled();
  });
});
