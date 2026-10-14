import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FolderOpen,
  History,
  Loader2,
  Smile,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { InitialsAvatar } from '@/components/shared'
import { FeatureGuard } from '@/context/FeatureFlagsContext'
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:gap-x-3 lg:px-4">
        <TooltipButton
          tooltip="Back to my queue"
          tooltipSide="bottom"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          asChild
        >
          <Link to="/queue/doctor">
            <ArrowLeft className="size-5" />
          </Link>
        </TooltipButton>

        <div className="hidden sm:block">
          <InitialsAvatar name={patient.fullName} size="md" />
        </div>
        <div className="min-w-0 flex-1 basis-24">
          <h1 className="truncate text-lg font-semibold leading-tight">
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
            <span className="rounded-md bg-primary-soft px-2.5 py-1 font-mono text-sm font-bold text-primary-text">
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
          className="order-last flex w-full items-center gap-1 overflow-x-auto lg:order-none lg:w-auto"
          aria-label="Patient record"
        >
          <RecordShortcut
            tooltip="Visit history"
            label="History"
            onClick={() => onOpenRecord('history')}
          >
            <History className="size-5" />
          </RecordShortcut>
          <FeatureGuard feature="patients.teeth_chart">
            <RecordShortcut
              tooltip="Teeth chart"
              label="Teeth"
              onClick={() => onOpenRecord('teeth')}
            >
              <Smile className="size-5" />
            </RecordShortcut>
          </FeatureGuard>
          <RecordShortcut
            tooltip="Vitals & dental info"
            label="Vitals"
            onClick={() => onOpenRecord('vitals')}
          >
            <Activity className="size-5" />
          </RecordShortcut>
          <FeatureGuard feature="patients.documents">
            <RecordShortcut
              tooltip="X-rays & files"
              label="Files"
              onClick={() => onOpenRecord('files')}
            >
              <FolderOpen className="size-5" />
            </RecordShortcut>
          </FeatureGuard>
        </nav>

        <Button
          className="h-11 shrink-0 gap-2 bg-emerald px-4 text-base text-white hover:bg-emerald/90 sm:px-5"
          onClick={onComplete}
          disabled={completing || done || !queueEntry}
        >
          {completing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
          <span className="sm:hidden">Complete</span>
          <span className="hidden sm:inline">Complete visit</span>
        </Button>
      </div>

      {alerts.length > 0 && (
        <div
          className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-3 py-2 lg:px-4"
          role="list"
          aria-label="Patient alerts"
        >
          {alerts.map((a) => (
            <span
              key={a.key}
              role="listitem"
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
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
      className="h-11 gap-1.5 px-3 text-sm"
      onClick={onClick}
    >
      {children}
      <span className="hidden xl:inline">{label}</span>
    </TooltipButton>
  )
}
