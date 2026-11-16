import {
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  scheduleNotificationAsync,
} from 'expo-notifications';

import { NOTIFICATION_CHANNELS } from '@/core/notifications/channels';

import type { ReminderPort } from './reminder-scheduler';

/** The real port: local DATE-triggered notifications on the `reminders` channel. They fire with no network. */
export const expoReminderPort: ReminderPort = {
  async listPendingIds() {
    const all = await getAllScheduledNotificationsAsync();
    return all.map((n) => n.identifier);
  },
  async schedule(r) {
    await scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: r.data, sound: 'default' },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: r.fireAtMs,
        channelId: NOTIFICATION_CHANNELS.reminders,
      },
    });
  },
  async cancel(id) {
    await cancelScheduledNotificationAsync(id);
  },
};
