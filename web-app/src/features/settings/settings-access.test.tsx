import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createAccessChecks } from '@/features/access/lib/access'
import {
  AccessContext,
  DISABLED_ACCESS,
} from '@/features/access/lib/access-context'
import type { AccessContextValue } from '@/features/access/lib/access-context'
import type { MeAccess } from '@/features/access'
import { NAV_ITEMS } from '@/features/access/nav/nav.registry'
import { useSettingsItems } from './hooks/useSettingsItems'
import { SETTINGS_ITEMS, isSettingsItemActive } from './lib/settings.registry'

function accessOf(over: Partial<MeAccess>): AccessContextValue {
  const data: MeAccess = {
    version: 1,
    organizationId: 'o1',
    locationId: 'l1',
    isSuperAdmin: false,
    isOwner: false,
    features: [],
    permissions: {},
    roles: [],
    employeeId: null,
    homeRoute: null,
    nav: null,
    ...over,
  }
  return {
    ...DISABLED_ACCESS,
    ...createAccessChecks(data),
    status: 'ready',
    isOwner: data.isOwner,
    version: 1,
  }
}

function keysFor(access: AccessContextValue, query = '') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
  )
  const { result } = renderHook(() => useSettingsItems(query), { wrapper })
  return result.current.flatMap((g) => g.items.map((i) => i.key))
}

const ROUTES = join(__dirname, '../../routes')

/** The route file serving `href` (`/settings/roles` → settings.roles.index.tsx). */
function routeFile(href: string) {
  const base = href.slice(1).replace(/\//g, '.')
  const index = join(ROUTES, `${base}.index.tsx`)
  return existsSync(index) ? index : join(ROUTES, `${base}.tsx`)
}

/** `staticData.can` of a route file, read from source (routes are the contract). */
function routeCan(file: string): unknown {
  const m = /staticData:\s*\{\s*can:\s*(\[[^\]]*\]|'[^']*')/.exec(
    readFileSync(file, 'utf8'),
  )
  return m ? JSON.parse(m[1].replace(/'/g, '"').replace(/,\s*\]/, ']')) : undefined
}

describe('settings registry', () => {
  it('every item has a route, gated by the same permission', () => {
    for (const item of SETTINGS_ITEMS) {
      const file = routeFile(item.href)
      expect(existsSync(file), `${item.href} has no route file`).toBe(true)
      expect(routeCan(file), item.href).toEqual(item.can)
    }
  })

  it('no settings page is also a sidebar item', () => {
    const sidebar = new Set(Object.values(NAV_ITEMS).map((n) => n.href))
    for (const item of SETTINGS_ITEMS)
      expect(sidebar.has(item.href), item.href).toBe(false)
  })

  it('staff without admin permissions see only their own account', () => {
    expect(keysFor(accessOf({ features: ['billing.invoices'] }))).toEqual([
      'profile',
      'appearance',
      'security',
      'sessions',
    ])
  })

  it('shows each page for its own permission only', () => {
    const keys = keysFor(
      accessOf({
        permissions: { 'notifications.settings.manage': true },
        features: ['billing.invoices'],
      }),
    )
    expect(keys).toContain('notifications')
    expect(keys).not.toContain('billing')
    expect(keys).not.toContain('theme')
  })

  it('needs the billing feature as well as admin.settings.manage', () => {
    const perms = { 'admin.settings.manage': true } as const
    expect(keysFor(accessOf({ permissions: perms }))).not.toContain('billing')
    expect(
      keysFor(accessOf({ permissions: perms, features: ['billing.invoices'] })),
    ).toContain('billing')
  })

  it('clinic profile and plan are for the owner only', () => {
    const all = Object.fromEntries(
      ['admin.theme.manage', 'admin.users.manage'].map((p) => [p, true]),
    )
    const staff = keysFor(accessOf({ permissions: all }))
    expect(staff).not.toContain('clinic-profile')
    expect(staff).not.toContain('subscription')
    const owner = keysFor(accessOf({ isOwner: true }))
    expect(owner).toContain('clinic-profile')
    expect(owner).toContain('subscription')
  })

  it('search matches labels, descriptions and keywords', () => {
    const owner = accessOf({
      isOwner: true,
      permissions: { 'admin.theme.manage': true },
    })
    expect(keysFor(owner, 'logo')).toEqual(['theme'])
    expect(keysFor(owner, 'TIMEZONE')).toEqual(['clinic-profile'])
    expect(keysFor(owner, 'zzz')).toEqual([])
  })

  it('library tabs keep the library item active', () => {
    const lib = SETTINGS_ITEMS.find((i) => i.key === 'prescription-library')!
    expect(isSettingsItemActive(lib, '/settings/medicine-directory')).toBe(true)
    expect(isSettingsItemActive(lib, '/settings/labs')).toBe(false)
  })
})
