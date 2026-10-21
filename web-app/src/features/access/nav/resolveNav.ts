import type { ElementType } from 'react'
import { Folder } from 'lucide-react'
import type { PermissionRequirement } from '../types/access.types'
import { FOOTER_NAV_KEYS, NAV_ICONS, NAV_ITEMS } from './nav.registry'
import type {
  NavItemDef,
  NavLayout,
  NavLayoutGroup,
  NavLayoutItem,
} from './nav.registry'

export interface NavLink {
  key: string
  label: string
  icon: ElementType
  href: string
}

export interface NavGroupView {
  label: string
  icon: ElementType
  children: NavLink[]
}

export type NavEntryView = NavLink | NavGroupView

export interface NavSectionView {
  label?: string
  items: NavEntryView[]
}

export interface NavViewer {
  can: (perm?: PermissionRequirement | null) => boolean
  isSuperAdmin: boolean
  isOwner: boolean
  isLabMember: boolean
}

export const isNavGroup = (e: NavEntryView): e is NavGroupView =>
  'children' in e

const isLayoutGroup = (
  i: NavLayoutItem | NavLayoutGroup,
): i is NavLayoutGroup => 'group' in i

const registry: Record<string, NavItemDef | undefined> = NAV_ITEMS
const icons: Record<string, ElementType | undefined> = NAV_ICONS

/** Whether `viewer` may see a registry item. Layout never widens this. */
export function canSeeNavItem(def: NavItemDef, viewer: NavViewer): boolean {
  if (def.superAdminOnly && !viewer.isSuperAdmin) return false
  if (def.ownerOrSuperAdmin && !viewer.isOwner && !viewer.isSuperAdmin)
    return false
  if (def.labMember && !viewer.isLabMember) return false
  return viewer.can(def.can)
}

/**
 * Turn a layout into the visible sidebar tree: unknown, hidden, duplicate and
 * not-permitted items are dropped, then empty groups and sections. Registry
 * items the layout forgot land in a trailing "More" section so a new page
 * never silently disappears.
 */
export function resolveNav(
  layout: NavLayout,
  viewer: NavViewer,
): NavSectionView[] {
  const hidden = new Set(layout.hidden)
  const placed = new Set<string>(FOOTER_NAV_KEYS)

  const link = (item: NavLayoutItem): NavLink | null => {
    const def = registry[item.key]
    if (!def || placed.has(item.key)) return null
    placed.add(item.key)
    if (hidden.has(item.key) || !canSeeNavItem(def, viewer)) return null
    return {
      key: item.key,
      label: item.label ?? def.label,
      icon: def.icon,
      href: def.href,
    }
  }
  const group = (g: NavLayoutGroup): NavGroupView => ({
    label: g.label,
    icon: (g.icon ? icons[g.icon] : undefined) ?? Folder,
    children: g.items.map(link).filter((l) => l !== null),
  })

  const sections: NavSectionView[] = layout.sections.map((s) => {
    if (s.group) {
      // Whole section is one collapsible group (no section header).
      const g = group({
        label: s.label ?? '',
        group: true,
        icon: s.icon,
        items: s.items.flatMap((i) => (isLayoutGroup(i) ? i.items : [i])),
      })
      return { items: [g] }
    }
    return {
      label: s.label,
      items: s.items
        .map((i) => (isLayoutGroup(i) ? group(i) : link(i)))
        .filter((e) => e !== null),
    }
  })

  const leftovers = Object.keys(NAV_ITEMS)
    .filter((key) => !placed.has(key))
    .map((key) => link({ key }))
    .filter((l) => l !== null)
  if (leftovers.length) sections.push({ label: 'More', items: leftovers })

  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((e) => !isNavGroup(e) || e.children.length > 0),
    }))
    .filter((s) => s.items.length > 0)
}
