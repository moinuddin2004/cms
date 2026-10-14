import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, UserRound } from 'lucide-react'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePatient } from '@/features/patients/hooks/usePatient'
import { useVitals } from '@/features/patients/hooks/usePatientSubEntities'
import {
  PrescriptionStatus,
  usePrescriptionsByEncounter,
} from '@/features/prescriptions'
import type { PrescriptionMedicine } from '@/features/prescriptions'
import { useQueueAction } from '@/features/queue/hooks/useQueueAction'
import { entryAction } from '@/features/queue/services/queue.api'
import { saveVisitNotes } from '../services/consultation.api'
import { useWorkspace } from '../hooks/useConsultation'
import { useAutosave } from '../hooks/useAutosave'
import { latestVitals, patientAlerts } from '../utils/patientInfo'
import type {
  ConsultationWorkspace,
  VisitNotes as VisitNotesValue,
} from '../types'
import { ConsultationHeader } from '../components/ConsultationHeader'
import { PatientSnapshot } from '../components/PatientSnapshot'
import { VisitNotes } from '../components/VisitNotes'
import { TreatmentsToday } from '../components/TreatmentsToday'
import { PrescriptionPanel } from '../components/PrescriptionPanel'
import type { RxCommand } from '../components/PrescriptionPanel'
import { RecordDrawer } from '../components/RecordDrawer'
import type { RecordTab } from '../components/RecordDrawer'
import { CompleteDialog } from '../components/CompleteDialog'
import type { RxSummary } from '../components/CompleteDialog'

const notesFrom = (e: ConsultationWorkspace['encounter']): VisitNotesValue => ({
  chiefComplaint: e.chiefComplaint ?? e.reason ?? '',
  examination: e.examination ?? '',
  diagnosis: e.diagnosis ?? '',
  advice: e.advice ?? '',
  followUpDate: e.followUpDate ?? '',
})

/**
 * The doctor's one working screen for a patient in the chair: alerts and
 * history on one side, notes → treatment → prescription on the other, and the
 * rest of the record one tap away in a slide-over. Nothing here needs a page
 * change, and everything saves itself.
 */
export function ConsultationPage({ encounterId }: { encounterId: string }) {
  const navigate = useNavigate()
  const {
    data: workspace,
    isLoading,
    isError,
    refetch,
  } = useWorkspace(encounterId)
  const patientId = workspace?.encounter.patientId ?? ''
  const { data: patient } = usePatient(patientId)
  const { data: vitalsList } = useVitals(patientId)
  const vitals = useMemo(() => latestVitals(vitalsList), [vitalsList])
  const { data: visitRx } = usePrescriptionsByEncounter(encounterId)

  // ── Notes (seeded once, then owned by this screen and auto-saved) ────
  const [notes, setNotes] = useState<VisitNotesValue | null>(null)
  useEffect(() => {
    if (workspace && notes === null) setNotes(notesFrom(workspace.encounter))
  }, [workspace, notes])
  const notesSave = useAutosave(
    notes,
    (n) => (n ? saveVisitNotes(encounterId, n) : Promise.resolve()),
    { enabled: notes !== null },
  )

  // ── Things one panel asks another to do ──────────────────────────────
  const [rxCommand, setRxCommand] = useState<RxCommand | null>(null)
  const nonce = useRef(0)
  const reuseMedicines = useCallback((medicines: PrescriptionMedicine[]) => {
    setRxCommand({ medicines, nonce: ++nonce.current })
  }, [])
  const addTemplateAdvice = useCallback((text: string) => {
    setNotes((n) => (n && !n.advice.trim() ? { ...n, advice: text } : n))
  }, [])

  const rxFlush = useRef<() => Promise<boolean>>(async () => true)
  const registerRxFlush = useCallback((flush: () => Promise<boolean>) => {
    rxFlush.current = flush
  }, [])

  // ── Patient record slide-over ────────────────────────────────────────
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordTab, setRecordTab] = useState<RecordTab>('history')
  const openRecord = useCallback((tab: RecordTab) => {
    setRecordTab(tab)
    setRecordOpen(true)
  }, [])
  const [showSummary, setShowSummary] = useState(false)

  // ── Complete ─────────────────────────────────────────────────────────
  const [completeOpen, setCompleteOpen] = useState(false)
  const entry = workspace?.queueEntry ?? null
  const complete = useQueueAction(
    async () => {
      if (!entry) throw new Error('This visit has no queue entry')
      // Whatever was typed a second ago must be on the server first.
      const saved = await Promise.all([notesSave.flush(), rxFlush.current()])
      if (saved.includes(false)) {
        throw new Error(
          'Your latest changes could not be saved. Check the connection and try again.',
        )
      }
      return entryAction(entry.id, 'complete', entry.version)
    },
    {
      success: () => 'Visit completed',
      onError: () => {
        setCompleteOpen(false)
        void refetch()
      },
    },
  )

  const rxSummary: RxSummary = useMemo(() => {
    const rx = visitRx?.[0]
    if (!rx) return 'none'
    return rx.status === PrescriptionStatus.FINALIZED ? 'signed' : 'draft'
  }, [visitRx])

  const alerts = useMemo(
    () => (patient ? patientAlerts(patient, vitals) : []),
    [patient, vitals],
  )

  if (isLoading || (workspace && !patient)) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <LoadingSkeleton variant="detail" />
      </div>
    )
  }
  if (isError || !workspace || !patient || !notes) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <ErrorState
          title="Couldn’t open this consultation"
          description="Check your connection and try again, or go back to your queue."
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  const { encounter, doctor } = workspace

  return (
    <div className="min-h-screen bg-muted/30">
      <ConsultationHeader
        workspace={workspace}
        patient={patient}
        alerts={alerts}
        onOpenRecord={openRecord}
        onComplete={() => setCompleteOpen(true)}
        completing={complete.isPending}
      />

      <main className="grid items-start gap-4 p-3 lg:grid-cols-[320px_minmax(0,1fr)] lg:p-4 xl:grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)]">
        <Button
          variant="outline"
          className="h-11 justify-between lg:hidden"
          aria-expanded={showSummary}
          onClick={() => setShowSummary((s) => !s)}
        >
          <span className="flex items-center gap-2">
            <UserRound className="size-4" /> Patient summary & history
          </span>
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              showSummary && 'rotate-180',
            )}
          />
        </Button>

        <aside
          className={cn(
            'lg:row-span-2 lg:block xl:row-span-1',
            showSummary ? 'block' : 'hidden',
          )}
        >
          <PatientSnapshot
            patient={patient}
            encounterId={encounterId}
            vitals={vitals}
            onOpenRecord={openRecord}
            onUseMedicines={reuseMedicines}
          />
        </aside>

        <div className="space-y-4 lg:col-start-2">
          <VisitNotes
            value={notes}
            onChange={setNotes}
            saveState={notesSave.state}
            savedAt={notesSave.savedAt}
          />
          <TreatmentsToday
            encounterId={encounterId}
            patientId={patient.id}
            treatments={encounter.treatments ?? []}
          />
        </div>

        <div className="lg:col-start-2 xl:col-start-3">
          <PrescriptionPanel
            encounterId={encounterId}
            encounterDate={encounter.encounterDate}
            patientId={patient.id}
            doctorId={doctor?.id ?? null}
            notes={notes}
            latestVitals={vitals}
            command={rxCommand}
            onTemplateAdvice={addTemplateAdvice}
            registerFlush={registerRxFlush}
          />
        </div>
      </main>

      <RecordDrawer
        patient={patient}
        tab={recordTab}
        open={recordOpen}
        onOpenChange={setRecordOpen}
        onTabChange={setRecordTab}
      />

      <CompleteDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        notes={notes}
        treatmentCount={encounter.treatments?.length ?? 0}
        rx={rxSummary}
        pending={complete.isPending}
        onConfirm={() =>
          complete.mutate(undefined, {
            onSuccess: () => void navigate({ to: '/queue/doctor' }),
          })
        }
      />
    </div>
  )
}
