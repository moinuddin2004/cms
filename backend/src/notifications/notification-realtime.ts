/** Socket room of one signed-in user — the gateway joins it on connect; clients can't `subscribe` to it. */
export const userRoom = (userId: string) => `user:${userId}`;

/** Socket event the web app listens for to refresh the bell, toast and chime. */
export const NOTIFICATION_NEW_EVENT = 'notification.new';
