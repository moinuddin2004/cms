import { useState } from 'react'
import type { ReactNode } from 'react'
import { FlaskConical, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusBadge,
} from '@/components/shared'
import { LabContactSheet } from '../components/LabContactSheet'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { useActiveLab, usePortalLab } from '../hooks/useLabPortal'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 text-sm">
      <dt className="text-text-3">{label}</dt>
      <dd className="col-span-2 break-words text-foreground">
        {children || '—'}
      </dd>
    </div>
  )
}

/** The lab's own details. Lab admins edit the contact fields. */
export function LabProfilePage() {
  const { isLabAdmin } = useActiveLab()
  const { data: lab, isLoading, isError, refetch } = usePortalLab()
  const [editing, setEditing] = useState(false)

  const editButton = isLabAdmin && lab && (
    <Button onClick={() => setEditing(true)}>
      <Pencil className="size-4" /> Edit details
    </Button>
  )

  return (
    <LabPortalLayout
      title="Lab profile"
      subtitle="How clinics and couriers reach your lab."
      actions={editButton}
    >
      {isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !lab ? (
        <EmptyState icon={FlaskConical} title="Lab not found" />
      ) : (
        <section className="max-w-3xl rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium">{lab.name}</h2>
            <StatusBadge
              status={lab.status}
              tone={lab.status === 'active' ? 'success' : 'danger'}
            />
            <Badge variant={lab.labType === 'internal' ? 'violet' : 'outline'}>
              {lab.labType === 'internal' ? 'In-house' : 'External'}
            </Badge>
          </div>
          <dl className="divide-y divide-border">
            <Row label="Phone">{lab.phone}</Row>
            <Row label="WhatsApp">{lab.whatsappPhone}</Row>
            <Row label="Email">{lab.email}</Row>
            <Row label="City">{lab.city}</Row>
            <Row label="Address">{lab.address}</Row>
          </dl>
          {!isLabAdmin && (
            <p className="mt-4 text-xs text-text-3">
              Only lab admins can change these details.
            </p>
          )}
        </section>
      )}
      <LabContactSheet
        open={editing}
        onOpenChange={setEditing}
        lab={lab ?? null}
      />
    </LabPortalLayout>
  )
}
