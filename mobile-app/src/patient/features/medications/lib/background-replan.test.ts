import * as Notifications from 'expo-notifications';

import { getRefreshToken } from '@/patient/lib/session';

import { readPersistedPlanInput, replanRemindersFromCache } from './background-replan';
import { at, event, schedule } from './test-fixtures';

let mockCache: Record<string, string> = {};
jest.mock('@/core/storage/secure-cache', () => ({
  openSecureCache: jest.fn(async () => ({ getString: (k: string) => mockCache[k] })),
}));
jest.mock('@/patient/lib/session', () => ({ getRefreshToken: jest.fn() }));
let mockPermission = 'granted';
jest.mock('@/core/notifications/permissions', () => ({
  getPermissionState: jest.fn(async () => mockPermission),
}));

const persisted = (queries: unknown[]) =>
  JSON.stringify({ timestamp: 1, buster: 'b', clientState: { mutations: [], queries } });
const q = (queryKey: unknown[], data: unknown) => ({ queryKey, state: { data, status: 'success' } });

beforeEach(async () => {
  jest.clearAllMocks();
  mockPermission = 'granted';
  (getRefreshToken as jest.Mock).mockResolvedValue('session:token');
  mockCache = {};
  await Notifications.cancelAllScheduledNotificationsAsync();
});

describe('readPersistedPlanInput', () => {
  it('reads schedules, server events, the unsent queue and the private choice for the cached account', () => {
    const due = at(2026, 11, 16, 20);
    const cache: Record<string, string> = {
      'query-cache': persisted([
        q(['medications', 'acc-1'], [schedule()]),
        q(['dose-events', 'acc-1', '2026-11-15'], [event('s1', due)]),
        q(['dose-events', 'other', '2026-11-15'], [event('zzz', due)]),
        q(['records-prescriptions', 'acc-1', null], []),
      ]),
      'doseQueue:acc-1': JSON.stringify([event('s1', at(2026, 11, 17, 8), 'skipped')]),
      'reminderSettings:acc-1': JSON.stringify({ private: true }),
    };
    const input = readPersistedPlanInput({ getString: (k) => cache[k] })!;
    expect(input.accountId).toBe('acc-1');
    expect(input.schedules).toHaveLength(1);
    expect(input.events.map((e) => e.scheduleId).sort()).toEqual(['s1', 's1']);
    expect(input.privateReminders).toBe(true);
  });

  it('is null without a cached medications query or with garbage', () => {
    expect(readPersistedPlanInput({ getString: () => undefined })).toBeNull();
    expect(readPersistedPlanInput({ getString: () => 'not json' })).toBeNull();
    expect(
      readPersistedPlanInput({ getString: () => persisted([q(['records-prescriptions', 'a', null], [])]) }),
    ).toBeNull();
  });

  it('defaults to not private when the choice was never saved', () => {
    const cache: Record<string, string> = { 'query-cache': persisted([q(['medications', 'acc-1'], [])]) };
    expect(readPersistedPlanInput({ getString: (k) => cache[k] })!.privateReminders).toBe(false);
  });
});

describe('replanRemindersFromCache (shell, patient space not mounted)', () => {
  const fill = (priv = false) => {
    mockCache = {
      'query-cache': persisted([q(['medications', 'acc-1'], [schedule({ startDate: '2020-01-01' })])]),
      'reminderSettings:acc-1': JSON.stringify({ private: priv }),
    };
  };

  it('schedules the doses plus the window-end nudge from the cache alone', async () => {
    fill();
    await replanRemindersFromCache();
    const ids = (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
    expect(ids.filter((i) => /^dose\.s1\./.test(i)).length).toBeGreaterThan(0);
    expect(ids.some((i) => i.startsWith('dose.window-end.'))).toBe(true);
  });

  it('honours private reminders (no medicine text)', async () => {
    fill(true);
    await replanRemindersFromCache();
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    expect(pending.length).toBeGreaterThan(0);
    expect(JSON.stringify(pending)).not.toContain('Amoxicillin');
  });

  it('does nothing without a patient session, permission or a cache', async () => {
    fill();
    (getRefreshToken as jest.Mock).mockResolvedValue(null);
    await replanRemindersFromCache();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    (getRefreshToken as jest.Mock).mockResolvedValue('t');
    mockPermission = 'denied';
    await replanRemindersFromCache();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    mockPermission = 'granted';
    mockCache = {};
    await replanRemindersFromCache();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('a second pass changes nothing; a stopped schedule has its reminders cancelled', async () => {
    fill();
    await replanRemindersFromCache();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
    await replanRemindersFromCache();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

    mockCache['query-cache'] = persisted([q(['medications', 'acc-1'], [schedule({ status: 'stopped' })])]);
    await replanRemindersFromCache();
    expect(await Notifications.getAllScheduledNotificationsAsync()).toHaveLength(0);
  });
});
