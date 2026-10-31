import { useId, useMemo } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deriveBrandPalette, isHexColor } from '../lib/color'
import { deriveDarkBase } from '../lib/dark-base'
import { DARK_BASE_OPTIONS, DEFAULT_THEME } from '../types'
import type { DarkBase } from '../types'

/**
 * Dark mode base: one card per preset with a small dark sample (page, card,
 * brand button). Sample colours depend on the brand, so they come from a
 * scoped style block rather than fixed classes.
 */
export function DarkBaseField({
  id,
  value,
  brandColor,
  onChange,
  disabled,
}: {
  id: string
  value: DarkBase
  brandColor: string
  onChange: (v: DarkBase) => void
  disabled?: boolean
}) {
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const brand = isHexColor(brandColor) ? brandColor : DEFAULT_THEME.brand_color
  const css = useMemo(() => {
    const button = deriveBrandPalette(brand).dark.brand
    return DARK_BASE_OPTIONS.map(({ value: preset }) => {
      const t = deriveDarkBase(preset, brand)
      return `[data-dark-base-swatch='${scope}-${preset}'] { --sw-bg: ${t.background}; --sw-card: ${t.surface}; --sw-border: ${t.border}; --sw-text: ${t.text}; --sw-muted: ${t.text3}; --sw-brand: ${button}; }`
    }).join('\n')
  }, [brand, scope])

  return (
    <>
      <style>{css}</style>
      <div
        id={id}
        role="radiogroup"
        aria-label="Dark mode base"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {DARK_BASE_OPTIONS.map((o) => {
          const selected = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={cn(
                'rounded-lg border border-border p-1.5 text-left transition-colors hover:border-primary/50 disabled:opacity-50',
                selected && 'border-primary ring-1 ring-primary',
              )}
            >
              <div
                data-dark-base-swatch={`${scope}-${o.value}`}
                className="relative rounded-md border border-[var(--sw-border)] bg-[var(--sw-bg)] p-1.5"
              >
                <div className="space-y-1 rounded border border-[var(--sw-border)] bg-[var(--sw-card)] p-1.5">
                  <div className="h-1.5 w-3/4 rounded-full bg-[var(--sw-text)]" />
                  <div className="h-1.5 w-1/2 rounded-full bg-[var(--sw-muted)]" />
                  <div className="h-2.5 w-8 rounded-sm bg-[var(--sw-brand)]" />
                </div>
                {selected && (
                  <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <div className="px-0.5 pt-1.5">
                <div className="text-xs font-semibold text-foreground">
                  {o.label}
                </div>
                <div className="text-[11px] leading-tight text-text-3">
                  {o.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
