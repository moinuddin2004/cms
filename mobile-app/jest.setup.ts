/**
 * Global Jest setup for the mobile app (card M0-06, docs/09 §2).
 *
 * Native modules are mocked here so unit tests run on the Node/Jest
 * environment without a device or a development build. Every mock is
 * in-memory and deterministic.
 */

// ==================== expo-secure-store: in-memory key/value map ====================
// Only tokens and encryption keys use SecureStore (docs/03 §2.5). Tests read
// and write through the same async API the app uses.
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();

  return {
    // Keychain accessibility constants (values are opaque to the mock).
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    ALWAYS: 'ALWAYS',
    ALWAYS_THIS_DEVICE_ONLY: 'ALWAYS_THIS_DEVICE_ONLY',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',

    isAvailableAsync: jest.fn(async () => true),
    getItem: jest.fn((key: string) => items.get(key) ?? null),
    getItemAsync: jest.fn(async (key: string) => items.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      items.set(key, value);
    }),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      items.set(key, value);
    }),
    deleteItem: jest.fn((key: string) => {
      items.delete(key);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      items.delete(key);
    }),
  };
});

// ==================== react-native-mmkv: the library's own Jest mock ====================
// v4's automatic in-Jest mock cannot load because importing the package pulls in
// the Nitro ESM runtime. `__mocks__/react-native-mmkv.ts` wires the library's own
// `createMockMMKV` instead of a hand-written fake, and keeps the v4 API
// (`createMMKV` / `deleteMMKV`) over an in-memory Map (docs/09 §2, M0-03 review).
// Jest applies that manual mock automatically — no `jest.mock` call needed.

// ==================== expo-notifications: scheduled-notification list ====================
// expo-notifications is installed by card M0-07; the virtual mock keeps the
// setup file importable today and gives tests a real scheduled list afterwards.
jest.mock(
  'expo-notifications',
  () => {
    const scheduled = new Map<string, unknown>();

    return {
      setNotificationHandler: jest.fn(),
      getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
      requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
      getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
      setNotificationChannelAsync: jest.fn(async () => null),
      scheduleNotificationAsync: jest.fn(
        async (request: { identifier?: string; content?: unknown; trigger?: unknown }) => {
          const identifier = request.identifier ?? `scheduled-${scheduled.size + 1}`;
          scheduled.set(identifier, { ...request, identifier });
          return identifier;
        },
      ),
      cancelScheduledNotificationAsync: jest.fn(async (identifier: string) => {
        scheduled.delete(identifier);
      }),
      cancelAllScheduledNotificationsAsync: jest.fn(async () => {
        scheduled.clear();
      }),
      getAllScheduledNotificationsAsync: jest.fn(async () => Array.from(scheduled.values())),
      addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
      addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
      AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
    };
  },
  { virtual: true },
);

// ==================== NetInfo: always online ====================
jest.mock('@react-native-community/netinfo', () => {
  const online = {
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: null,
  };

  const api = {
    configure: jest.fn(),
    fetch: jest.fn(async () => online),
    refresh: jest.fn(async () => online),
    useNetInfo: jest.fn(() => online),
    addEventListener: jest.fn((listener: (state: typeof online) => void) => {
      listener(online);
      return jest.fn();
    }),
  };

  return { __esModule: true, default: api, ...api };
});

// ==================== expo-crypto: deterministic randomUUID ====================
// Idempotency keys (docs/04 §8) use `randomUUID`; a counter keeps tests
// deterministic. `getRandomBytes` stays the real implementation because the
// storage cache key needs real bytes.
jest.mock('expo-crypto', () => {
  const actual = jest.requireActual<Record<string, unknown>>('expo-crypto');
  let counter = 0;

  return {
    ...actual,
    randomUUID: jest.fn(
      () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
    ),
  };
});
