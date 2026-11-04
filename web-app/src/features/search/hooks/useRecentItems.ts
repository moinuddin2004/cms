import { useCallback, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import type { RecentItem } from '../types'

const MAX_RECENT = 8
const keyFor = (orgId: string | null) => `quick-search:recent:${orgId ?? 'none'}`

function read(key: string): RecentItem[] {
  try {
    const raw = localStorage.getItem(key)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list)
      ? list
          .filter(
            (x): x is RecentItem =>
              !!x &&
              typeof x === 'object' &&
              typeof (x as RecentItem).href === 'string' &&
              typeof (x as RecentItem).title === 'string',
          )
          .slice(0, MAX_RECENT)
      : []
  } catch {
    return []
  }
}

/** Recently opened search results, per clinic, kept in this browser only. */
export function useRecentItems() {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const key = keyFor(orgId)
  const [items, setItems] = useState<RecentItem[]>(() => read(key))
  const [loadedKey, setLoadedKey] = useState(key)
  if (loadedKey !== key) {
    setLoadedKey(key)
    setItems(read(key))
  }

  const remember = useCallback(
    (item: RecentItem) => {
      setItems((prev) => {
        const next = [
          item,
          ...prev.filter((p) => !(p.kind === item.kind && p.id === item.id)),
        ].slice(0, MAX_RECENT)
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // Storage blocked (private window): keep it in memory only.
        }
        return next
      })
    },
    [key],
  )

  return { items, remember }
}
