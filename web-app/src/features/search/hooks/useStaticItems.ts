import { useMemo } from 'react'
import { CalendarPlus, Settings, UserPlus } from 'lucide-react'
import {
  DEFAULT_NAV_LAYOUT,
  isNavGroup,
  resolveNav,
  useAccess,
  useNavViewer,
} from '@/features/access'
import type { StaticSearchItem } from '../types'

/** Extra words a page answers to, keyed by href. */
const PAGE_KEYWORDS: Record<string, string[]> = {
  '/settings': [
    'theme',
    'roles',
    'navigation',
    'features',
    'location',
    'tax',
    'preferences',
  ],
  '/patients': ['mr', 'records'],
  '/appointments': ['calendar', 'booking', 'schedule'],
  '/billing': ['cash', 'counter', 'collect'],
  '/employees': ['staff', 'team', 'doctors'],
  '/invoices': ['bills'],
}

const ACTIONS: StaticSearchItem[] = [
  {
    id: 'action.new-patient',
    kind: 'action',
    label: 'New patient',
    keywords: ['add patient', 'register'],
    icon: UserPlus,
    href: '/patients?create=1',
    can: 'patients.create',
  },
  {
    id: 'action.book-appointment',
    kind: 'action',
    label: 'Book appointment',
    keywords: ['new appointment', 'schedule'],
    icon: CalendarPlus,
    href: '/appointments?create=1',
    can: 'appointments.book',
  },
]

/**
 * Pages the sidebar would show this user (same layout + permission rules,
 * with the clinic's renames) and the quick actions they may run.
 */
export function useStaticItems() {
  const access = useAccess()
  const viewer = useNavViewer()

  return useMemo(() => {
    const sections = resolveNav(access.nav ?? DEFAULT_NAV_LAYOUT, viewer)
    const leaves = sections.flatMap((s) =>
      s.items.flatMap((e) => (isNavGroup(e) ? e.children : [e])),
    )
    const pages: StaticSearchItem[] = [
      ...leaves.map((l) => ({
        id: `page.${l.key}`,
        kind: 'page' as const,
        label: l.label,
        keywords: PAGE_KEYWORDS[l.href],
        icon: l.icon,
        href: l.href,
      })),
      {
        id: 'page.nav.settings',
        kind: 'page',
        label: 'Settings',
        keywords: PAGE_KEYWORDS['/settings'],
        icon: Settings,
        href: '/settings',
      },
    ]
    const actions = ACTIONS.filter((a) => viewer.can(a.can))
    return { pages, actions }
  }, [access.nav, viewer])
}
