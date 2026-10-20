import api from '@/lib/api'
import type {
  AudienceSetting,
  AudienceSettingInput,
  MyNotification,
  NotificationAudience,
  NotificationOverview,
  NotificationTemplate,
  OutboxLogEntry,
  OutboxLogParams,
  PatientCommPrefs,
  Paginated,
  RuleChange,
  TemplateInput,
} from '../types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function send<T>(
  method: 'post' | 'patch' | 'put' | 'delete',
  url: string,
  body?: object,
): Promise<T> {
  const { data } =
    method === 'delete' ? await api.delete(url) : await api[method](url, body)
  return data.data as T
}

/** Clinic notification settings — clinic admins only. */
export const notificationSettingsApi = {
  patientPrefs: (patientId: string) =>
    get<PatientCommPrefs>(`/notification-settings/patients/${patientId}/prefs`),
  updatePatientPrefs: (
    patientId: string,
    body: Partial<
      Pick<PatientCommPrefs, 'whatsappOptOut' | 'smsOptOut' | 'emailOptOut'>
    >,
  ) =>
    send<PatientCommPrefs>(
      'put',
      `/notification-settings/patients/${patientId}/prefs`,
      body,
    ),
  overview: () => get<NotificationOverview>('/notification-settings'),
  updateAudience: (
    audience: NotificationAudience,
    body: AudienceSettingInput,
  ) =>
    send<AudienceSetting>(
      'patch',
      `/notification-settings/audiences/${audience}`,
      body,
    ),
  updateRules: (rules: RuleChange[]) =>
    send<{ changed: number }>('put', '/notification-settings/rules', { rules }),
  templates: (eventCode: string) =>
    get<NotificationTemplate[]>('/notification-settings/templates', {
      eventCode,
    }),
  saveTemplate: (body: TemplateInput) =>
    send<NotificationTemplate>('put', '/notification-settings/templates', body),
  resetTemplate: (id: string) =>
    send<null>('delete', `/notification-settings/templates/${id}`),
  log: (params: OutboxLogParams) =>
    get<Paginated<OutboxLogEntry>>('/notification-settings/log', params),
}

/** The signed-in user's own in-app notifications. */
export const myNotificationsApi = {
  list: (params: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    get<Paginated<MyNotification>>('/me/notifications', params),
  unreadCount: () => get<{ count: number }>('/me/notifications/unread-count'),
  markRead: (id: string) =>
    send<MyNotification>('post', `/me/notifications/${id}/read`),
  markAllRead: () =>
    send<{ updated: number }>('post', '/me/notifications/read-all'),
}
