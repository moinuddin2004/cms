import { useEffect, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { locationThemeSchema } from '../schemas/theme.schema'
import type { LocationThemeFormValues } from '../schemas/theme.schema'
import type { ThemeKey, ThemeKeyView } from '../types'
import { useSaveLocationTheme } from './useThemeQueries'

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** The location's own values only — empty fields inherit the clinic's. */
function defaultsFor(
  view: ThemeKeyView[] | undefined,
): LocationThemeFormValues {
  const own = (key: ThemeKey) =>
    str(view?.find((k) => k.key === key)?.location?.value)
  return {
    app_name: own('app_name'),
    logo_url: own('logo_url'),
    logo_dark_url: own('logo_dark_url'),
  }
}

/** A location's name / logo overrides, in the location sheet. */
export function useLocationThemeForm({
  locationId,
  view,
  onDone,
}: {
  locationId: string | null
  view: ThemeKeyView[] | undefined
  onDone: () => void
}) {
  const save = useSaveLocationTheme(locationId)
  const defaults = useMemo(() => defaultsFor(view), [view])
  const readOnly = useMemo(
    () => new Set((view ?? []).filter((k) => k.lockedAbove).map((k) => k.key)),
    [view],
  )

  const form = useForm({
    defaultValues: defaults,
    validators: {
      onChange: locationThemeSchema,
      onSubmit: locationThemeSchema,
    },
    onSubmit: async ({ value }) => {
      const values: Record<string, string | null> = {}
      for (const key of Object.keys(value) as (keyof typeof value)[]) {
        if (readOnly.has(key)) continue
        const next = value[key].trim()
        if (next !== defaults[key]) values[key] = next || null
      }
      if (Object.keys(values).length) await save.mutateAsync(values)
      onDone()
    },
  })

  useEffect(() => {
    form.reset(defaults)
  }, [defaults, form])

  return { form, readOnly }
}
