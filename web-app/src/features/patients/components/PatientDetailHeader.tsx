import { useState } from 'react'
import { OutstandingBadge, useOutstanding } from '@/features/billing'
import { useAccess } from '@/features/access/hooks/useAccess'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { BackButton } from '@/components/shared/BackButton'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { usePageTitle } from '@/hooks/useBackNavigation'
import { History, Phone, Mail } from 'lucide-react'
import { PatientAuditSheet } from './PatientAuditSheet'
import type { Patient } from '../types'

interface PatientDetailHeaderProps {
  patient: Patient
}

function getAge(dob: string | null): string {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))} years`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PatientDetailHeader({ patient }: PatientDetailHeaderProps) {
  usePageTitle(patient.fullName)
  return (
    <div className="flex items-center gap-3 py-1">
      <BackButton to="/patients" label="Back to patients" />

      <Avatar className="w-9 h-9 shrink-0">
        <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold text-xs">
          {getInitials(patient.fullName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-semibold text-foreground leading-tight truncate">
            {patient.fullName}
          </h1>
          <Badge
            variant={patient.isActive ? 'default' : 'secondary'}
            className={
              patient.isActive
                ? 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/10 text-[10px] px-1.5 py-0'
                : 'bg-muted text-muted-foreground text-[10px] px-1.5 py-0'
            }
          >
            {patient.isActive ? 'Active' : 'Inactive'}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">
            {patient.patientNumber}
          </span>
          <PatientDuesBadge patientId={patient.id} />
          {patient.dob && (
            <span className="text-[11px] text-muted-foreground">
              {getAge(patient.dob)}
            </span>
          )}
          {patient.gender && (
            <span className="text-[11px] text-muted-foreground capitalize">
              {patient.gender}
            </span>
          )}
          {patient.bloodGroup && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {patient.bloodGroup}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Phone size={11} /> {patient.phone}
          </span>
          {patient.email && (
            <span className="flex items-center gap-1">
              <Mail size={11} /> {patient.email}
            </span>
          )}
        </div>
      </div>

      <PatientAuditButton patient={patient} />
    </div>
  )
}

/** Change history of the patient, for whoever may read the audit log. */
function PatientAuditButton({ patient }: { patient: Patient }) {
  const canAudit = useAccess().can('admin.audit.view')
  const [open, setOpen] = useState(false)
  if (!canAudit) return null
  return (
    <>
      <TooltipButton
        tooltip="Change history"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <History size={15} />
      </TooltipButton>
      <PatientAuditSheet
        patientId={patient.id}
        patientName={patient.fullName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

/** Dues / advance badge for whoever may see invoices, when the location shows it (D22). */
function PatientDuesBadge({ patientId }: { patientId: string }) {
  const canBill = useAccess().can('billing.invoice.view')
  const dues = useOutstanding(canBill ? [patientId] : [])
  if (!canBill) return null
  return (
    <OutstandingBadge
      row={dues.data?.[0]}
      className="text-[10px] px-1.5 py-0"
    />
  )
}
