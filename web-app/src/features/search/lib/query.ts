import type { StaticSearchItem } from '../types'

/** Mirrors the backend minimums: 2 letters, or 3 digits for a number. */
export function isSearchable(q: string): boolean {
  const t = q.trim()
  if (/^[\d\s+\-()]+$/.test(t)) return t.replace(/\D/g, '').length >= 3
  return t.length >= 2
}

/**
 * Pages/actions whose label or keywords contain the query, best first:
 * label starts with it → a word in the label starts with it → anywhere.
 */
export function filterStatic(
  items: StaticSearchItem[],
  q: string,
  limit = 6,
): StaticSearchItem[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  const score = (item: StaticSearchItem): number => {
    const label = item.label.toLowerCase()
    if (label.startsWith(needle)) return 0
    if (label.split(/\s+/).some((w) => w.startsWith(needle))) return 1
    if (label.includes(needle)) return 2
    if (item.keywords?.some((k) => k.toLowerCase().includes(needle))) return 3
    return -1
  }
  return items
    .map((item) => ({ item, s: score(item) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map((x) => x.item)
}

/** Splits `text` around the first case-insensitive match of `q`. */
export function splitMatch(
  text: string,
  q: string,
): { before: string; match: string; after: string } | null {
  const needle = q.trim()
  if (!needle) return null
  const i = text.toLowerCase().indexOf(needle.toLowerCase())
  if (i < 0) return null
  return {
    before: text.slice(0, i),
    match: text.slice(i, i + needle.length),
    after: text.slice(i + needle.length),
  }
}
