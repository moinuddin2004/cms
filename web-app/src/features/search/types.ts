import type { ElementType } from 'react'
import type { PermissionRequirement } from '@/features/access'

/** Record kinds the server search returns (mirrors backend `SearchType`). */
export type SearchType = 'patients'

/** One server result row. */
export interface SearchItem {
  id: string
  type: SearchType
  title: string
  subtitle: string | null
  href: string
  badges: string[]
}

export interface SearchGroup {
  type: SearchType
  items: SearchItem[]
  hasMore: boolean
}

export interface SearchResponse {
  query: string
  groups: SearchGroup[]
}

/** A page or action searched on the client (no API call). */
export interface StaticSearchItem {
  id: string
  kind: 'page' | 'action'
  label: string
  /** Extra words that should also match ("theme" → Settings). */
  keywords?: string[]
  icon: ElementType
  href: string
  can?: PermissionRequirement
}

/** A remembered result shown before anything is typed. */
export interface RecentItem {
  id: string
  kind: 'page' | 'action' | SearchType
  title: string
  subtitle: string | null
  href: string
}
