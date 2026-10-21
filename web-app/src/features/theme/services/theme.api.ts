import api from '@/lib/api'
import type { ClinicTheme, ThemeKeyView, ThemeUpdate } from '../types'

export const themeApi = {
  /** Resolved theme for the active org + location. */
  current: async (): Promise<ClinicTheme> =>
    (await api.get('/theme')).data.data,

  /** Pre-auth theme for the login page — theme tokens only. */
  public: async (
    organizationId: string,
    locationId?: string,
  ): Promise<ClinicTheme> =>
    (
      await api.get(`/public/theme/${organizationId}`, {
        params: locationId ? { locationId } : undefined,
      })
    ).data.data,

  org: async (): Promise<ThemeKeyView[]> =>
    (await api.get('/admin/theme')).data.data,

  saveOrg: async (input: ThemeUpdate): Promise<ThemeKeyView[]> =>
    (await api.put('/admin/theme', input)).data.data,

  location: async (locationId: string): Promise<ThemeKeyView[]> =>
    (await api.get(`/admin/theme/location/${locationId}`)).data.data,

  saveLocation: async (
    locationId: string,
    values: ThemeUpdate['values'],
  ): Promise<ThemeKeyView[]> =>
    (await api.put(`/admin/theme/location/${locationId}`, { values })).data
      .data,

  platform: async (): Promise<ThemeKeyView[]> =>
    (await api.get('/platform/theme')).data.data,

  savePlatform: async (input: ThemeUpdate): Promise<ThemeKeyView[]> =>
    (await api.put('/platform/theme', input)).data.data,

  /** Logo / favicon upload through the generic storage endpoint. */
  upload: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/uploads', formData, {
      params: { folder: 'branding' },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data.url
  },
}
