import api from '@/lib/api'
import type { NavLayout } from '@/features/access'
import type { NavLayoutRecord } from '../types/nav-builder.types'

export const navBuilderApi = {
  /** The clinic layout, or null while the clinic uses the code default. */
  get: async (): Promise<NavLayoutRecord | null> =>
    (await api.get('/admin/navigation')).data.data,

  save: async (layout: NavLayout): Promise<NavLayoutRecord> =>
    (await api.put('/admin/navigation', layout)).data.data,

  reset: async (): Promise<void> => {
    await api.delete('/admin/navigation')
  },
}
