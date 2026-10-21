import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { themeApi } from '../services/theme.api'
import type { ThemeUpdate } from '../types'

export const themeKeys = {
  all: ['theme'] as const,
  current: (orgId: string | null, locationId: string | null) =>
    ['theme', 'current', orgId, locationId] as const,
  public: (orgId: string | null) => ['theme', 'public', orgId] as const,
  org: (orgId: string | null) => ['theme', 'admin', orgId] as const,
  location: (locationId: string | null) =>
    ['theme', 'location', locationId] as const,
  platform: ['theme', 'platform'] as const,
}

const errorMessage = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

export function useOrgTheme(orgId: string | null) {
  return useQuery({
    queryKey: themeKeys.org(orgId),
    queryFn: themeApi.org,
    enabled: !!orgId,
  })
}

export function useLocationTheme(locationId: string | null) {
  return useQuery({
    queryKey: themeKeys.location(locationId),
    queryFn: () => themeApi.location(locationId!),
    enabled: !!locationId,
  })
}

export function usePlatformTheme(enabled: boolean) {
  return useQuery({
    queryKey: themeKeys.platform,
    queryFn: themeApi.platform,
    enabled,
  })
}

/** Any theme write changes what every theme query resolves to. */
function useThemeMutation<T>(
  fn: (input: T) => Promise<unknown>,
  success: string,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(success)
      return qc.invalidateQueries({ queryKey: themeKeys.all })
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not save the theme')),
  })
}

export const useSaveOrgTheme = () =>
  useThemeMutation(
    (input: ThemeUpdate) => themeApi.saveOrg(input),
    'Theme saved',
  )

export const useSaveLocationTheme = (locationId: string | null) =>
  useThemeMutation(
    (values: ThemeUpdate['values']) =>
      themeApi.saveLocation(locationId!, values),
    'Location branding saved',
  )

export const useSavePlatformTheme = () =>
  useThemeMutation(
    (input: ThemeUpdate) => themeApi.savePlatform(input),
    'Platform defaults saved',
  )

export function useUploadLogo() {
  return useMutation({
    mutationFn: themeApi.upload,
    onError: (err) => toast.error(errorMessage(err, 'Upload failed')),
  })
}
