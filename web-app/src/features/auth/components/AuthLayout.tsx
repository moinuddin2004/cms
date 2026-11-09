import type { ReactNode } from 'react'
import { useSearch } from '@tanstack/react-router'
import { AuthPanelLayout } from './AuthPanelLayout'
import { AuthSplitLayout } from './AuthSplitLayout'
import { AuthStageLayout } from './AuthStageLayout'

export type AuthLayoutVariant = 'split' | 'panel' | 'stage'

interface AuthLayoutProps {
  children: ReactNode
  /** Overrides `?auth=` (used by the auth screens themselves). */
  variant?: AuthLayoutVariant
}

function isVariant(value: unknown): value is AuthLayoutVariant {
  return value === 'split' || value === 'panel' || value === 'stage'
}

/**
 * Shared shell for every auth screen.
 *
 * Three layouts are available; pick one with `?auth=split|panel|stage`
 * (default: split). Screens can also pin a variant with the `variant` prop.
 */
export function AuthLayout({ children, variant }: AuthLayoutProps) {
  const search = useSearch({ strict: false })
  const requested = variant ?? search.auth
  const active = isVariant(requested) ? requested : 'split'

  if (active === 'panel') return <AuthPanelLayout>{children}</AuthPanelLayout>
  if (active === 'stage') return <AuthStageLayout>{children}</AuthStageLayout>
  return <AuthSplitLayout>{children}</AuthSplitLayout>
}
