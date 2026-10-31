import { useMemo } from 'react'
import { useAccess } from '@/features/access'
import {
  SETTINGS_GROUPS,
  SETTINGS_ITEMS,
  canSeeSettingsItem,
  matchesSettingsSearch,
} from '../lib/settings.registry'
import type {
  SettingsGroupId,
  SettingsItemDef,
} from '../lib/settings.registry'

export interface SettingsGroupView {
  id: SettingsGroupId
  label: string
  items: SettingsItemDef[]
}

/** The settings pages this user may open, grouped, optionally filtered by a search. */
export function useSettingsItems(query = '') {
  const { can, hasFeature, isOwner } = useAccess()
  return useMemo<SettingsGroupView[]>(() => {
    const viewer = { can, hasFeature, isOwner }
    return SETTINGS_GROUPS.map((g) => ({
      ...g,
      items: SETTINGS_ITEMS.filter(
        (i) =>
          i.group === g.id &&
          canSeeSettingsItem(i, viewer) &&
          matchesSettingsSearch(i, query),
      ),
    })).filter((g) => g.items.length > 0)
  }, [can, hasFeature, isOwner, query])
}
