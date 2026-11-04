import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/store/useAuthStore'
import { searchApi } from '../services/search.api'
import { isSearchable } from '../lib/query'

export const searchKeys = {
  all: ['global-search'] as const,
  query: (orgId: string | null, locationId: string | null, q: string) =>
    [...searchKeys.all, orgId, locationId, q] as const,
}

/** Debounced server search for the palette; idle until the query is long enough. */
export function useGlobalSearch(query: string) {
  const q = useDebounce(query.trim(), 250)
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const locationId = useAuthStore((s) => s.activeLocationId)
  const enabled = isSearchable(q)

  const result = useQuery({
    queryKey: searchKeys.query(orgId, locationId, q),
    queryFn: ({ signal }) => searchApi.search(q, {}, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  return {
    ...result,
    /** Query the results belong to (debounced). */
    debouncedQuery: q,
    enabled,
    /** Typed text has not reached the debounced query yet. */
    isDebouncing: query.trim() !== q,
  }
}
