import { Link } from '@tanstack/react-router'
import { Building2, ClipboardList, Users } from 'lucide-react'
import { ErrorState, LoadingSkeleton, StatCard } from '@/components/shared'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { useActiveLab, usePortalLab } from '../hooks/useLabPortal'
import { usePortalOrders } from '../hooks/usePortalOrders'

/** Lab portal home: orders waiting for an answer, clinics and team. */
export function LabPortalDashboardPage() {
  const { membership } = useActiveLab()
  const { data: lab, isLoading, isError, refetch } = usePortalLab()
  const waiting = usePortalOrders({ page: 1, limit: 1, status: 'submitted' })

  return (
    <LabPortalLayout
      title={membership ? `Welcome to ${membership.labName}` : 'Lab portal'}
      subtitle="Your lab's workspace on MedTrackr."
    >
      <div className="space-y-6">
        {isLoading ? (
          <LoadingSkeleton variant="stats" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : lab ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link to="/lab-portal/orders" className="block">
              <StatCard
                label="Orders waiting for you"
                value={waiting.data?.total ?? '—'}
                icon={ClipboardList}
              />
            </Link>
            <Link to="/lab-portal/clinics" className="block">
              <StatCard
                label="Active clinics"
                value={lab.activeLinkCount}
                icon={Building2}
              />
            </Link>
            <StatCard
              label="Team members"
              value={lab.memberCount}
              icon={Users}
            />
          </div>
        ) : null}
      </div>
    </LabPortalLayout>
  )
}
