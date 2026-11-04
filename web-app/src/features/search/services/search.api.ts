import api from '@/lib/api'
import type { ApiResponse } from '@/features/patients/types'
import type { SearchResponse, SearchType } from '../types'

export const searchApi = {
  /** Global quick search; the server drops types the caller may not view. */
  search: async (
    q: string,
    opts: { types?: SearchType[]; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<SearchResponse> => {
    const res = await api.get<ApiResponse<SearchResponse>>('/search', {
      params: {
        q,
        types: opts.types?.join(','),
        limit: opts.limit,
      },
      signal,
    })
    return res.data.data
  },
}
