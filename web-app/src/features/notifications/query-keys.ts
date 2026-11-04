import type { OutboxLogParams } from './types'

export const notificationKeys = {
  settings: {
    all: ['notification-settings'] as const,
    overview: ['notification-settings', 'overview'] as const,
    templates: (eventCode: string) =>
      ['notification-settings', 'templates', eventCode] as const,
    log: (params: OutboxLogParams) =>
      ['notification-settings', 'log', params] as const,
  },
  mine: {
    all: ['my-notifications'] as const,
    list: ['my-notifications', 'list'] as const,
    unread: ['my-notifications', 'unread'] as const,
    prefs: ['my-notifications', 'prefs'] as const,
  },
}
