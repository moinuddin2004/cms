import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Building2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { LabClinicsPanel } from '../components/LabClinicsPanel'
import { LabMembersPanel } from '../components/LabMembersPanel'
import { LabSheet } from '../components/LabSheet'
import { LabStatusSwitch } from '../components/LabStatusSwitch'
import { useLab, useLabHistory } from '../hooks/useLabDirectory'
import type { Lab } from '../types'

/** One platform lab: contact details, staff, clinics and its history. */
export function LabDetailPage({ labId }: { labId: string }) {
  const { data: lab, isLoading, isError, refetch } = useLab(labId)
  const history = useLabHistory(labId)
  const [editing, setEditing] = useState(false)

  return (
    <DashboardLayout
      title={lab?.name ?? 'Lab'}
      subtitle={lab ? subtitleFor(lab) : undefined}
      backTo="/lab-directory"
      backLabel="Back to lab directory"
      actions={
        lab && (
          <div className="flex items-center gap-3">
            <LabStatusSwitch lab={lab} />
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
          </div>
        )
      }
    >
      {isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : isError || !lab ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            <Detail icon={Phone} label="Phone" value={lab.phone} />
            <Detail
              icon={MessageCircle}
              label="WhatsApp"
              value={lab.whatsappPhone}
            />
            <Detail icon={Mail} label="Email" value={lab.email} />
            <Detail icon={MapPin} label="City" value={lab.city} />
            <Detail icon={MapPin} label="Address" value={lab.address} />
            <Detail
              icon={Building2}
              label="Belongs to"
              value={lab.ownerOrganization?.name ?? 'Independent lab'}
            />
          </section>

          <Tabs defaultValue="staff">
            <TabsList>
              <TabsTrigger value="staff">Staff ({lab.memberCount})</TabsTrigger>
              <TabsTrigger value="clinics">
                Clinics ({lab.activeLinkCount})
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="staff" className="pt-4">
              <LabMembersPanel labId={lab.id} />
            </TabsContent>
            <TabsContent value="clinics" className="pt-4">
              <LabClinicsPanel labId={lab.id} />
            </TabsContent>
            <TabsContent value="activity" className="pt-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <ActivityTimeline
                  entries={history.data}
                  isLoading={history.isLoading}
                  isError={history.isError}
                  onRetry={() => void history.refetch()}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      <LabSheet open={editing} onOpenChange={setEditing} lab={lab ?? null} />
    </DashboardLayout>
  )
}

function subtitleFor(lab: Lab): string {
  return [
    lab.status === 'active' ? 'Active' : 'Suspended',
    lab.labType === 'internal' ? 'In-house lab' : 'External lab',
    lab.city,
  ]
    .filter(Boolean)
    .join(' · ')
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-4 text-text-3" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-3">{label}</p>
        <p className="break-words text-sm">{value || '—'}</p>
      </div>
    </div>
  )
}
