import { setNotificationChannelAsync } from 'expo-notifications';
import { Platform } from 'react-native';

import { createNotificationChannels } from './channels';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
}));

describe('createNotificationChannels', () => {
  it('never names a sound file: a missing file leaves the channel silent', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await createNotificationChannels();

    const calls = (setNotificationChannelAsync as jest.Mock).mock.calls;
    expect(calls.map(([id]) => id)).toEqual(['queue', 'reminders', 'general']);
    for (const [, options] of calls) expect(options).not.toHaveProperty('sound');
  });
});
