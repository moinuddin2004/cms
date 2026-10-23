import { useEffect } from 'react'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { NAV_ITEMS } from '@/features/access'
import { useNavHistoryStore } from '@/store/nav-history-store'
import type { NavHistoryEntry } from '@/store/nav-history-store'

declare module '@tanstack/history' {
  interface HistoryState {
    /** Opened from the sidebar — a fresh start, so top-level pages show no ←. */
    fromSidebar?: boolean
  }
}

/** `state` for sidebar links: `<Link to={href} state={SIDEBAR_NAV_STATE}>`. */
export const SIDEBAR_NAV_STATE = { fromSidebar: true }

// Never send the user back to these — auth screens and the `/` redirector.
const SKIP_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/select-location',
]

function isSkippable(pathname: string) {
  return pathname === '/' || SKIP_PATHS.some((p) => pathname.startsWith(p))
}

// Create forms are left behind once saved — back goes past them.
function isTransient(pathname: string) {
  return /\/(new|create)$/.test(pathname)
}

function useHistoryPosition() {
  const index = useRouterState({
    select: (s) => s.location.state.__TSR_index,
  })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return { index, pathname }
}

/** Mount once (root): records every page visited in this tab. */
export function useTrackNavHistory() {
  const { index, pathname } = useHistoryPosition()
  const record = useNavHistoryStore((s) => s.record)
  useEffect(() => {
    record(index, pathname)
  }, [index, pathname, record])
}

/** Lets the back button on the NEXT page say "Back to <title>". */
export function usePageTitle(title: string | undefined) {
  const { index, pathname } = useHistoryPosition()
  const setTitle = useNavHistoryStore((s) => s.setTitle)
  useEffect(() => {
    if (title) setTitle(index, pathname, title)
  }, [index, pathname, title, setTitle])
}

function labelFor(entry: NavHistoryEntry) {
  if (entry.title) return entry.title
  return Object.values(NAV_ITEMS).find((n) => n.href === entry.pathname)?.label
}

/**
 * Where ← should go: the page the user actually came from (browser history,
 * so scroll and list state come back), skipping same-page entries such as
 * tab/filter changes.
 *
 * Nested pages pass `fallbackTo`, used when the page was opened directly
 * (new tab, shared link) or history is unknown. Top-level pages pass none:
 * they get a ← only when reached from inside another page, and `null`
 * when opened from the sidebar or directly.
 */
export function useBackNavigation(fallbackTo?: string, fallbackLabel?: string) {
  const router = useRouter()
  const navigate = useNavigate()
  const { index, pathname } = useHistoryPosition()
  const fromSidebar = useRouterState({
    select: (s) => s.location.state.fromSidebar === true,
  })
  const entries = useNavHistoryStore((s) => s.entries)

  let steps = 0
  let target: NavHistoryEntry | undefined
  for (let i = index - 1; i >= 0; i--) {
    const entry = entries[i]
    if (!entry || isSkippable(entry.pathname)) break
    if (entry.pathname === pathname || isTransient(entry.pathname)) continue
    steps = index - i
    target = entry
    break
  }

  if (target && !(fromSidebar && !fallbackTo)) {
    const name = labelFor(target)
    return {
      label: name ? `Back to ${name}` : 'Back',
      href: target.pathname,
      goBack: () => router.history.go(-steps),
    }
  }
  if (!fallbackTo) return null
  return {
    label: fallbackLabel ?? 'Back',
    href: fallbackTo,
    goBack: () => void navigate({ to: fallbackTo }),
  }
}
