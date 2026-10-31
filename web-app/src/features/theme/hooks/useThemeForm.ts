import { useEffect, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { themeFormSchema } from '../schemas/theme.schema'
import type { ThemeFormValues } from '../schemas/theme.schema'
import { DEFAULT_THEME } from '../types'
import type { ThemeKey, ThemeKeyView, ThemeUpdate } from '../types'

export type ThemeScope = 'org' | 'platform'

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Form values from an admin view: what applies now, plus this scope's locks. */
export function themeFormDefaults(
  view: ThemeKeyView[] | undefined,
  scope: ThemeScope,
): ThemeFormValues {
  const byKey = new Map(view?.map((k) => [k.key, k]))
  const value = (key: ThemeKey) =>
    str(byKey.get(key)?.effective) || str(DEFAULT_THEME[key])
  const locks: Record<string, boolean> = {}
  for (const k of view ?? []) {
    locks[k.key] = (scope === 'platform' ? k.platform : k.org)?.locked ?? false
  }
  return {
    values: {
      app_name: value('app_name'),
      logo_url: value('logo_url'),
      logo_dark_url: value('logo_dark_url'),
      favicon_url: value('favicon_url'),
      brand_color: value('brand_color'),
      sidebar_style: value(
        'sidebar_style',
      ) as ThemeFormValues['values']['sidebar_style'],
      default_mode: value(
        'default_mode',
      ) as ThemeFormValues['values']['default_mode'],
      dark_base: value('dark_base') as ThemeFormValues['values']['dark_base'],
    },
    locks,
  }
}

/**
 * Only what changed: an edited value (empty → null, i.e. inherit) or a
 * flipped lock. Keys locked above this scope are never sent.
 */
export function themeChanges(
  before: ThemeFormValues,
  after: ThemeFormValues,
  readOnly: ReadonlySet<string>,
): ThemeUpdate {
  const values: NonNullable<ThemeUpdate['values']> = {}
  const locks: NonNullable<ThemeUpdate['locks']> = {}
  for (const key of Object.keys(after.values) as ThemeKey[]) {
    if (readOnly.has(key)) continue
    const next = after.values[key].trim()
    if (next !== before.values[key].trim()) values[key] = next || null
  }
  for (const [key, locked] of Object.entries(after.locks)) {
    if (readOnly.has(key)) continue
    if (locked !== (before.locks[key] ?? false)) locks[key as ThemeKey] = locked
  }
  return { values, locks }
}

/** The org theme (clinic admin) or platform defaults (super admin) form. */
export function useThemeForm({
  view,
  scope,
  onSave,
}: {
  view: ThemeKeyView[] | undefined
  scope: ThemeScope
  onSave: (update: ThemeUpdate) => Promise<unknown>
}) {
  const defaults = useMemo(() => themeFormDefaults(view, scope), [view, scope])
  const readOnly = useMemo(
    () => new Set((view ?? []).filter((k) => k.lockedAbove).map((k) => k.key)),
    [view],
  )

  const form = useForm({
    defaultValues: defaults,
    validators: { onChange: themeFormSchema, onSubmit: themeFormSchema },
    onSubmit: async ({ value }) => {
      await onSave(themeChanges(defaults, value, readOnly))
    },
  })

  // Re-seed whenever the server state changes (load, save, reset).
  useEffect(() => {
    form.reset(defaults)
  }, [defaults, form])

  return { form, readOnly }
}
