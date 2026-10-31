import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { useAccess } from '@/features/access'
import { ClinicDetailsForm } from '../components/ClinicDetailsForm'
import { useClinicSetup } from '../hooks/useAccount'
import { refreshSession } from '../lib/session'

/** Settings → Clinic profile: the details the setup wizard asked for (owner only). */
export function ClinicProfilePage() {
  const { isOwner } = useAccess()

  return (
    <DashboardLayout
      title="Clinic profile"
      subtitle="Used on invoices, prescriptions, reports and the login page."
    >
      {isOwner ? (
        <ClinicProfileContent />
      ) : (
        <EmptyState
          icon={Lock}
          title="Only the clinic owner can change this"
          description="Ask the owner to update the clinic's details."
        />
      )}
    </DashboardLayout>
  )
}

function ClinicProfileContent() {
  const setup = useClinicSetup()

  if (setup.isLoading) return <LoadingSkeleton variant="detail" />
  if (setup.isError || !setup.data)
    return <ErrorState onRetry={() => void setup.refetch()} />

  return (
    <div className="max-w-3xl rounded-xl border border-border bg-surface p-5">
      <ClinicDetailsForm
        mode="settings"
        setup={setup.data}
        onSaved={() => {
          toast.success('Clinic details saved')
          void refreshSession()
        }}
      />
    </div>
  )
}
