import {
  AndroidImportance,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Android notification channels, created once at app start (docs/02 §8,
 * card M0-07). Remote pushes must name one of these ids in `channelId`; local
 * dose reminders use `reminders`.
 *
 * No permission prompt is shown here: requesting permission is a deliberate
 * moment later (M1-05 staff, M3 patient). On Android 13 a channel must exist
 * before a push token can be requested, which is why they are created at start.
 */
export const NOTIFICATION_CHANNELS = {
  queue: 'queue',
  reminders: 'reminders',
  general: 'general',
} as const;

/** Best effort: a channel failure must never block app start. */
export async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await Promise.all([
      setNotificationChannelAsync(NOTIFICATION_CHANNELS.queue, {
        name: 'Queue alerts',
        description: 'When a patient checks in or their turn is near.',
        importance: AndroidImportance.HIGH,
        showBadge: true,
      }),
      setNotificationChannelAsync(NOTIFICATION_CHANNELS.reminders, {
        name: 'Medicine reminders',
        description: 'Reminders for medicine doses.',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        showBadge: true,
      }),
      setNotificationChannelAsync(NOTIFICATION_CHANNELS.general, {
        name: 'General',
        description: 'Other clinic updates.',
        importance: AndroidImportance.DEFAULT,
        showBadge: true,
      }),
    ]);
  } catch {
    // Channels are re-created (idempotent) on the next start.
  }
}
