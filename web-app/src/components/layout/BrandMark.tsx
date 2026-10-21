import { useState } from 'react'
import { useClinicTheme } from '@/features/theme'
import type { ClinicTheme } from '@/features/theme'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  /** Mark only (collapsed sidebar). */
  collapsed?: boolean
  /** `inverse` = on a dark surface: prefers the dark logo, light text. */
  tone?: 'default' | 'inverse'
  /** Render this theme instead of the active one (theme builder preview). */
  theme?: Pick<ClinicTheme, 'app_name' | 'logo_url' | 'logo_dark_url'>
  className?: string
}

/**
 * The clinic's logo + name from the theme. Falls back to an initial on the
 * brand colour when there is no logo or it fails to load. With both logos
 * set, styles.css shows the one matching the surface (`data-logo`).
 */
export function BrandMark({
  collapsed = false,
  tone = 'default',
  theme: override,
  className,
}: BrandMarkProps) {
  const active = useClinicTheme().theme
  const theme = override ?? active
  const [broken, setBroken] = useState<string[]>([])
  const usable = (url: string | null) =>
    url && !broken.includes(url) ? url : null
  const light = usable(theme.logo_url)
  const dark = usable(theme.logo_dark_url)
  const onError = (url: string) => () =>
    setBroken((prev) => (prev.includes(url) ? prev : [...prev, url]))

  const img = (url: string, which?: 'light' | 'dark') => (
    <img
      key={url + (which ?? '')}
      src={url}
      alt={collapsed ? theme.app_name : ''}
      data-logo={which}
      onError={onError(url)}
      className={cn(
        'h-8 w-auto shrink-0 object-contain',
        collapsed ? 'max-w-10' : 'max-w-[120px]',
      )}
    />
  )

  let mark
  if (tone === 'inverse' && (dark || light)) {
    mark = img((dark ?? light)!)
  } else if (light && dark) {
    mark = (
      <>
        {img(light, 'light')}
        {img(dark, 'dark')}
      </>
    )
  } else if (light || dark) {
    mark = img((light ?? dark)!)
  } else {
    mark = (
      <span
        aria-hidden={!collapsed}
        aria-label={collapsed ? theme.app_name : undefined}
        role={collapsed ? 'img' : undefined}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-700 text-sm font-bold text-primary-foreground"
      >
        {theme.app_name.trim().charAt(0).toUpperCase() || 'M'}
      </span>
    )
  }

  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-2 overflow-hidden',
        className,
      )}
      data-testid="brand-mark"
    >
      {mark}
      {!collapsed && (
        <span
          className={cn(
            'truncate whitespace-nowrap text-lg font-bold tracking-tight',
            tone === 'inverse' ? 'text-white/90' : 'text-foreground',
          )}
        >
          {theme.app_name}
        </span>
      )}
    </span>
  )
}
