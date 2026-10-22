import { useAuthStore } from '@/store/useAuthStore'
import type { NavViewer } from '../nav/resolveNav'
import { useAccess } from './useAccess'

/** The signed-in user as the nav resolver sees them. */
export function useNavViewer(): NavViewer {
  const access = useAccess()
  const isLabMember = useAuthStore((s) => s.labMemberships.length > 0)
  return {
    can: access.can,
    isSuperAdmin: access.isSuperAdmin,
    isOwner: access.isOwner,
    isLabMember,
  }
}
