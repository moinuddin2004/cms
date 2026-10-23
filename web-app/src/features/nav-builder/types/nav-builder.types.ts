import type { NavLayout } from '@/features/access'

/** `GET /admin/navigation` — the clinic layout row (null = code default). */
export interface NavLayoutRecord {
  layout: NavLayout
  version: number
  updatedBy: string | null
  updatedAt: string
}
