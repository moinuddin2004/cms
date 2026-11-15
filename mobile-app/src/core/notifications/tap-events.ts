import {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponseAsync,
  DEFAULT_ACTION_IDENTIFIER,
  getLastNotificationResponseAsync,
  type NotificationResponse,
} from 'expo-notifications';

import { parsePushData, type PushData } from './push-data';

function dataOf(response: NotificationResponse | null): { id: string; data: PushData } | null {
  if (!response || response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return null;
  const data = parsePushData(response.notification.request.content.data);
  return data ? { id: response.notification.request.identifier, data } : null;
}

/**
 * Calls `onTap` for every push the user taps: while the app runs (listener, "warm") and for the
 * tap that launched it (`getLastNotificationResponseAsync`, "cold"). The same response can arrive
 * through both, so each notification id is handled once. Returns the unsubscribe function.
 */
export function subscribeToPushTaps(onTap: (data: PushData) => void): () => void {
  const handled = new Set<string>();
  let live = true;

  const handle = (response: NotificationResponse | null) => {
    const tap = dataOf(response);
    if (!tap || handled.has(tap.id)) return;
    handled.add(tap.id);
    onTap(tap.data);
  };

  const subscription = addNotificationResponseReceivedListener((r) => {
    if (live) handle(r);
  });

  void getLastNotificationResponseAsync()
    .then(async (response) => {
      if (!live || !response) return;
      handle(response);
      // So a later restart of the JS runtime does not replay the same tap.
      await clearLastNotificationResponseAsync();
    })
    .catch(() => undefined);

  return () => {
    live = false;
    subscription.remove();
  };
}
