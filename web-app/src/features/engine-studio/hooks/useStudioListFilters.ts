import { useState } from 'react'
import type { ViewMode } from '@/components/shared'
import { useDebounce } from '@/hooks/useDebounce'

export const ALL = 'all'

/**
 * Filter + paging state shared by the Studio listings. Specialty / owner /
 * entity type go to the server; the text search and paging run here (the
 * engine lists are small and unpaginated).
 */
export function useStudioListFilters() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [specialtyId, setSpecialtyId] = useState(ALL)
  const [owner, setOwner] = useState(ALL)
  const [entityType, setEntityType] = useState(ALL)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim().toLowerCase()

  /** Text search + current page over rows the server already filtered. */
  const apply = <T extends { code: string; name: string }>(
    rows: T[] | undefined,
  ) => {
    const filtered = (rows ?? []).filter(
      (r) =>
        !query ||
        r.code.toLowerCase().includes(query) ||
        r.name.toLowerCase().includes(query),
    )
    return {
      filtered,
      pageRows: filtered.slice((page - 1) * limit, page * limit),
    }
  }

  const activeFilters =
    (query ? 1 : 0) +
    (specialtyId !== ALL ? 1 : 0) +
    (owner !== ALL ? 1 : 0) +
    (entityType !== ALL ? 1 : 0)

  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v)
    setPage(1)
  }

  return {
    viewMode,
    setViewMode,
    search,
    setSearch: reset(setSearch),
    specialtyId,
    setSpecialtyId: reset(setSpecialtyId),
    owner,
    setOwner: reset(setOwner),
    entityType,
    setEntityType: reset(setEntityType),
    page,
    setPage,
    limit,
    setLimit: (n: number) => {
      setLimit(n)
      setPage(1)
    },
    apply,
    activeFilters,
    /** Server-side params: undefined = no filter. */
    server: {
      specialtyId: specialtyId === ALL ? undefined : specialtyId,
      owner: owner === ALL ? undefined : owner,
      entityType: entityType === ALL ? undefined : entityType,
    },
    clear: () => {
      setSearch('')
      setSpecialtyId(ALL)
      setOwner(ALL)
      setEntityType(ALL)
      setPage(1)
    },
  }
}
