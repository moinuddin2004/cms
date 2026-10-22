import type { ReactNode } from 'react'
import { createAccessChecks } from '@/features/access/lib/access'
import {
  AccessContext,
  DISABLED_ACCESS,
} from '@/features/access/lib/access-context'
import type { AccessContextValue } from '@/features/access/lib/access-context'
import type { MeAccess } from '@/features/access'

/** Test-only: a ready AccessContext value granting exactly `permissions`. */
export function accessWith(
  permissions: MeAccess['permissions'],
  employeeId: string | null = 'd1',
): AccessContextValue {
  return {
    ...DISABLED_ACCESS,
    ...createAccessChecks({
      version: 1,
      organizationId: 'o',
      locationId: 'l',
      isSuperAdmin: false,
      isOwner: false,
      features: ['appointments.core'],
      permissions,
      roles: [],
      employeeId,
      homeRoute: null,
      nav: null,
    }),
    status: 'ready',
    employeeId,
  }
}

export function WithAccess({
  value,
  children,
}: {
  value: AccessContextValue
  children: ReactNode
}) {
  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  )
}

/** Permission sets matching the seeded role templates (expanded). */
export const PERMS = {
  admin: {
    'queue.board.view': true,
    'queue.checkin': true,
    'queue.entry.manage': true,
    'queue.entry.reprioritize': true,
    'queue.doctor.own': true,
    'queue.doctor.any': true,
    'admin.settings.manage': true,
    'appointments.view': 'org',
  },
  reception: {
    'queue.board.view': true,
    'queue.checkin': true,
    'queue.entry.manage': true,
  },
  doctor: {
    'queue.doctor.own': true,
    'appointments.view': 'own',
  },
} satisfies Record<string, MeAccess['permissions']>
