import { setNotificationHandler, type NotificationBehavior } from 'expo-notifications';

import { parsePushData } from './push-data';

/**
 * What to do with a push that arrives while the app is open (docs/02 §8): queue alerts get a
 * banner and sound; everything else only lands in the notification list (the in-app bell updates
 * through realtime, so a banner would be noise).
 */
export function foregroundBehavior(data: unknown): NotificationBehavior {
  const type = parsePushData(data)?.type ?? '';
  // A dose reminder that fires while the app is open must still be seen and heard.
  const loud = type.startsWith('queue.') || type.startsWith('medication.');
  return {
    shouldShowBanner: loud,
    shouldShowList: true,
    shouldPlaySound: loud,
    shouldSetBadge: false,
  };
}

/** Installs the foreground handler once, at app start. */
export function installForegroundHandler(): void {
  setNotificationHandler({
    handleNotification: async (notification) =>
      foregroundBehavior(notification.request.content.data),
  });
}
