import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  History,
  Loader2,
  Smile,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { BackButton } from '@/components/shared/BackButton'
import { usePageTitle } from '@/hooks/useBackNavigation'
import { InitialsAvatar } from '@/components/shared'
import { Can } from '@/features/access'
import { cn } from '@/lib/utils'
import type { Patient } from '@/features/patients'
import type { ConsultationWorkspace } from '../types'
import { ageLabel } from '../utils/patientInfo'
import type { PatientAlert } from '../utils/patientInfo'
import type { RecordTab } from './RecordDrawer'

function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

/**
 * Sticky top of the consultation: who the patient is, anything dangerous to
 * know before treating, shortcuts to the rest of the record, and Complete.
 */
export function ConsultationHeader({
  workspace,
  patient,
  alerts,
  onOpenRecord,
  onComplete,
  completing,
}: {
  workspace: ConsultationWorkspace
  patient: Patient
  alerts: PatientAlert[]
  onOpenRecord: (tab: RecordTab) => void
  onComplete: () => void
  completing: boolean
}) {
  usePageTitle(`${patient.fullName}'s consultation`)
  const { encounter, queueEntry, doctor } = workspace
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  const done = queueEntry ? queueEntry.status !== 'in_consultation' : false
  const age = ageLabel(patient.dob)
  const sub = [age, patient.gender, patient.patientNumber]
    .filter(Boolean)
    .join(' · ')

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:gap-x-3 lg:px-4">
        <BackButton to="/queue/doctor" label="Back to my queue" size="lg" />

        <div className="hidden sm:block">
          <InitialsAvatar name={patient.fullName} size="sm" />
        </div>
        <div className="min-w-0 flex-1 basis-24">
          <h1 className="truncate text-base font-semibold leading-tight">
            {patient.fullName}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {sub}
            {doctor
              ? ` · Dr. ${doctor.fullName.replace(/^Dr\.?\s*/i, '')}`
              : ''}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm">
          {queueEntry && (
            <span className="rounded-md bg-primary-soft px-2 py-0.5 font-mono text-xs font-bold text-primary-text">
              {queueEntry.token}
            </span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              done
                ? 'font-semibold text-emerald'
                : 'hidden text-muted-foreground sm:inline-flex',
            )}
          >
            {done ? (
              <>
                <CheckCircle2 className="size-3.5" /> Visit ended
              </>
            ) : (
              <>
                <Timer className="size-3.5" />
                {minutesSince(encounter.encounterDate, now)} min
              </>
            )}
          </span>
        </div>

        <nav
          className="order-last flex w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-muted/40 p-0.5 md:order-none md:w-auto"
          aria-label="Patient record"
        >
          <RecordShortcut
            tooltip="Visit history"
            label="History"
            onClick={() => onOpenRecord('history')}
          >
            <History className="size-4" />
          </RecordShortcut>
          <Can perm="patients.chart.edit">
            <RecordShortcut
              tooltip="Teeth chart"
              label="Teeth"
              onClick={() => onOpenRecord('teeth')}
            >
              <Smile className="size-4" />
            </RecordShortcut>
          </Can>
          <RecordShortcut
            tooltip="Vitals & dental info"
            label="Vitals"
            onClick={() => onOpenRecord('vitals')}
          >
            <Activity className="size-4" />
          </RecordShortcut>
          <Can perm="patients.documents.manage">
            <RecordShortcut
              tooltip="X-rays & files"
              label="Files"
              onClick={() => onOpenRecord('files')}
            >
              <FolderOpen className="size-4" />
            </RecordShortcut>
          </Can>
        </nav>

        <Button
          className="h-9 shrink-0 gap-1.5 bg-emerald px-3 text-white hover:bg-emerald/90 sm:px-4"
          onClick={onComplete}
          disabled={completing || done || !queueEntry}
        >
          {completing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          <span className="sm:hidden">Complete</span>
          <span className="hidden sm:inline">Complete visit</span>
        </Button>
      </div>

      {alerts.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 border-t border-border bg-muted/30 px-3 py-1.5 lg:px-4"
          role="list"
          aria-label="Patient alerts"
        >
          {alerts.map((a) => (
            <span
              key={a.key}
              role="listitem"
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                a.tone === 'danger'
                  ? 'bg-destructive text-white'
                  : 'bg-amber-soft text-amber',
              )}
            >
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">
                {a.label}
                {a.detail ? `: ${a.detail}` : ''}
              </span>
            </span>
          ))}
        </div>
      )}
    </header>
  )
}

function RecordShortcut({
  tooltip,
  label,
  onClick,
  children,
}: {
  tooltip: string
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <TooltipButton
      tooltip={tooltip}
      tooltipSide="bottom"
      variant="ghost"
      className="h-8 flex-1 gap-1.5 px-2.5 text-[13px] md:flex-none"
      onClick={onClick}
    >
      {children}
      <span>{label}</span>
    </TooltipButton>
  )
}
