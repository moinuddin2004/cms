import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastNotificationError } from '../lib/notification-errors'
import { notificationKeys } from '../query-keys'
import { notificationSettingsApi } from '../services/notifications.api'
import type {
  AudienceSettingInput,
  NotificationAudience,
  OutboxLogParams,
  PlatformOverride,
  RuleChange,
  TemplateInput,
} from '../types'

export function useNotificationOverview() {
  return useQuery({
    queryKey: notificationKeys.settings.overview,
    queryFn: notificationSettingsApi.overview,
  })
}

export function useNotificationTemplates(eventCode: string | null) {
  return useQuery({
    queryKey: notificationKeys.settings.templates(eventCode ?? ''),
    queryFn: () => notificationSettingsApi.templates(eventCode!),
    enabled: !!eventCode,
  })
}

export function useNotificationLog(params: OutboxLogParams) {
  return useQuery({
    queryKey: notificationKeys.settings.log(params),
    queryFn: () => notificationSettingsApi.log(params),
    placeholderData: keepPreviousData,
  })
}

/** A settings mutation: toasts, then refreshes every settings query. */
function useSettingsMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  success?: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
    },
    onError: toastNotificationError,
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: notificationKeys.settings.all,
      }),
  })
}

export function useUpdateAudience() {
  return useSettingsMutation(
    (v: { audience: NotificationAudience; input: AudienceSettingInput }) =>
      notificationSettingsApi.updateAudience(v.audience, v.input),
    'Notification settings saved',
  )
}

export function useUpdateRules() {
  return useSettingsMutation((rules: RuleChange[]) =>
    notificationSettingsApi.updateRules(rules),
  )
}

export function useSaveTemplate() {
  return useSettingsMutation(
    (body: TemplateInput) => notificationSettingsApi.saveTemplate(body),
    'Message wording saved',
  )
}

export function useResetTemplate() {
  return useSettingsMutation(
    (id: string) => notificationSettingsApi.resetTemplate(id),
    'Wording reset to the default',
  )
}

/** Super admin: this clinic's mandatory-email overrides. */
export function usePlatformOverrides(orgId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.settings.platform(orgId ?? ''),
    queryFn: () => notificationSettingsApi.platformOverrides(orgId!),
    enabled: enabled && !!orgId,
  })
}

export function useSetPlatformOverride(orgId: string | null) {
  return useSettingsMutation(
    (body: { eventCode: string; mode: PlatformOverride['mode'] }) =>
      notificationSettingsApi.setPlatformOverride(orgId!, body),
    'Mandatory email setting saved',
  )
}

export function useResetRules() {
  return useSettingsMutation(
    (_: void) => notificationSettingsApi.resetRules(),
    'Notification rules reset to defaults',
  )
}

/** Toasts the address it went to (verified addresses only). */
export function useSendTestEmail() {
  return useMutation({
    mutationFn: (_: void) => notificationSettingsApi.sendTestEmail(),
    onSuccess: (r) => toast.success(`Test email sent to ${r.to}`),
    onError: toastNotificationError,
  })
}
