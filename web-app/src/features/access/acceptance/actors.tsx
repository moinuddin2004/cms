import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'

// The role templates and catalog helpers are the backend's own (pure TS, no
// Nest): the acceptance tests mock `/me/access` per actor from them.
import { ROLE_TEMPLATES } from '../../../../../backend/src/access/catalog/templates'
import {
  expandImplies,
  fullGrant,
  normalizeGrants,
  PERMISSION_KEYS,
  PERMISSIONS,
} from '../../../../../backend/src/access/catalog/permissions'
import { createAccessChecks } from '../lib/access'
import { AccessContext, DISABLED_ACCESS } from '../lib/access-context'
import type { AccessContextValue } from '../lib/access-context'
import type { MeAccess } from '../types/access.types'
import type { NavLayout } from '../nav/nav.registry'

export type ActorName =
  'OwnerA' | 'SA' | 'AdminU' | 'Doc1' | 'RecU' | 'AsstU' | 'AcctU' | 'NoRoleU'

/** Every feature key the catalog's permissions hang on (all on, as in the fixtures). */
export const ALL_FEATURES: string[] = [
  ...new Set(
    PERMISSION_KEYS.map((k) => PERMISSIONS[k].feature).filter(
      (f) => f !== 'core',
    ),
  ),
]

const template = (key: string) =>
  expandImplies(
    normalizeGrants(ROLE_TEMPLATES.find((t) => t.key === key)!.permissions),
  )

const everything = () =>
  Object.fromEntries(PERMISSION_KEYS.map((k) => [k, fullGrant(k)]))

const TEMPLATE_OF: Partial<Record<ActorName, string>> = {
  AdminU: 'admin',
  Doc1: 'doctor',
  RecU: 'receptionist',
  AsstU: 'assistant',
  AcctU: 'accountant',
}

/** `/me/access` of a fixture actor, as the backend resolves it. */
export function meFor(
  actor: ActorName,
  over: Partial<MeAccess> = {},
): MeAccess {
  const owner = actor === 'OwnerA' || actor === 'SA'
  const tpl = TEMPLATE_OF[actor]
  const t = tpl ? ROLE_TEMPLATES.find((x) => x.key === tpl) : undefined
  return {
    version: 7,
    organizationId: 'orgA',
    locationId: 'L1',
    isSuperAdmin: actor === 'SA',
    isOwner: actor === 'OwnerA',
    features: ALL_FEATURES,
    permissions: (owner
      ? everything()
      : tpl
        ? template(tpl)
        : {}) as MeAccess['permissions'],
    roles: t ? [{ id: `role-${t.key}`, name: t.name, templateKey: t.key }] : [],
    employeeId: owner || actor === 'NoRoleU' ? null : `emp-${actor}`,
    homeRoute: t?.homeRoute ?? null,
    nav: null,
    ...over,
  }
}

/** The context value `useAccess()` reads, from a `/me/access` payload. */
export function accessValue(
  data: MeAccess,
  over: Partial<AccessContextValue> = {},
): AccessContextValue {
  return {
    ...DISABLED_ACCESS,
    ...createAccessChecks(data),
    status: 'ready',
    isSuperAdmin: data.isSuperAdmin,
    isOwner: data.isOwner,
    employeeId: data.employeeId,
    homeRoute: data.homeRoute,
    nav: data.nav,
    version: data.version,
    ...over,
  }
}

/** Render `ui` as `actor` (or an explicit payload). */
export function renderAs(
  actor: ActorName | MeAccess,
  ui: ReactNode,
  over: Partial<AccessContextValue> = {},
): RenderResult {
  const data = typeof actor === 'string' ? meFor(actor) : actor
  return render(
    <AccessContext.Provider value={accessValue(data, over)}>
      {ui}
    </AccessContext.Provider>,
  )
}

export type { NavLayout }
