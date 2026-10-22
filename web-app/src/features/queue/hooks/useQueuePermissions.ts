import { useMemo } from 'react'
import { useAccess } from '@/features/access'
import type { AccessContextValue } from '@/features/access'

/**
 * What the signed-in user may do in the queue, from `/me/access`. Used only
 * to hide buttons the API would refuse — the API enforces the same rules.
 * While loading everything reports false, so restricted buttons never flash.
 */
export interface QueuePermissions {
  isLoading: boolean
  employeeId: string | null
  /** `queue.checkin` — check-in, walk-in, back from test. */
  canCheckIn: boolean
  /** `queue.entry.manage` — skip, rejoin, remove, transfer any entry. */
  canManageEntries: boolean
  /** `queue.entry.reprioritize` — urgent priority, smart/FIFO for today. */
  canReprioritize: boolean
  /** `queue.doctor.any` — run (and force-complete in) any doctor's queue. */
  canRunAnyQueue: boolean
  /** `queue.doctor.own` — the doctor screen for one's own queue. */
  canRunOwnQueue: boolean
  /** `admin.settings.manage` — save the queue policies. */
  canManageSettings: boolean
  /** Doctor actions in this doctor's queue: any doctor, or one's own. */
  isDoctorOf: (doctorId: string) => boolean
}

export function queuePermissionsFrom(
  access: Pick<AccessContextValue, 'can' | 'employeeId' | 'isLoading'>,
): QueuePermissions {
  const canRunAnyQueue = access.can('queue.doctor.any')
  const canRunOwnQueue = access.can('queue.doctor.own')
  const employeeId = access.employeeId
  return {
    isLoading: access.isLoading,
    employeeId,
    canCheckIn: access.can('queue.checkin'),
    canManageEntries: access.can('queue.entry.manage'),
    canReprioritize: access.can('queue.entry.reprioritize'),
    canRunAnyQueue,
    canRunOwnQueue,
    canManageSettings: access.can('admin.settings.manage'),
    isDoctorOf: (doctorId) =>
      canRunAnyQueue ||
      (canRunOwnQueue && !!employeeId && employeeId === doctorId),
  }
}

export function useQueuePermissions(): QueuePermissions {
  const access = useAccess()
  return useMemo(() => queuePermissionsFrom(access), [access])
}
