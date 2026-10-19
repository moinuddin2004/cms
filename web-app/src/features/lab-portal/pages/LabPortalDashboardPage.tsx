import { Link } from '@tanstack/react-router'
import { Building2, ClipboardList, Users } from 'lucide-react'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatCard,
} from '@/components/shared'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { useActiveLab, usePortalLab } from '../hooks/useLabPortal'

/**
 * Lab portal home. Orders are not built yet (lab ERD §19, Sprint 6), so it
 * shows the lab's numbers and says where orders will appear.
 */
export function LabPortalDashboardPage() {
  const { membership } = useActiveLab()
  const { data: lab, isLoading, isError, refetch } = usePortalLab()

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <EmptyState
          icon={ClipboardList}
          title="Orders arrive here soon"
          description="Lab orders from your clinics will show up on this page in a later release. Until then, accept clinic invitations and keep your lab details up to date."
        />
      </div>
    </LabPortalLayout>
  )
}
