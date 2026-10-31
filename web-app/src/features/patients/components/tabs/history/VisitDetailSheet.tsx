import { Link } from '@tanstack/react-router'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { Can } from '@/features/access/components/Can'
import { ENTRY_STATUS_LABELS } from '@/features/queue'
import type { PatientVisit } from '@/features/queue'
import {
  PrescriptionStatusBadge,
  usePrescriptionsByEncounter,
} from '@/features/prescriptions'
import { formatCurrency } from '@/lib/formatters'
import {
  CalendarClock,
  ClipboardList,
  ExternalLink,
  FileText,
  Footprints,
  History,
  NotebookPen,
  Plus,
  Stethoscope,
  Syringe,
} from 'lucide-react'
import { useEncounterDetail } from '../../../hooks/usePatientSubEntities'
import type { Encounter } from '../../../types'
import { TreatmentFormDialog } from '../TreatmentFormDialog'
import {
  CHIP_TONES,
  Chip,
  DateBlock,
  DetailSection,
  Timeline,
  num,
  timeOf,
} from './HistoryParts'

interface VisitDetailSheetProps {
  patientId: string
  encounterId: string | null
  /** The queue entry behind the visit: doctor, token, status, timings. */
  visit?: PatientVisit
  onClose: () => void
  /** Clinical-only view (doctor's consultation): no fees, no fee entry. */
  hideAmounts?: boolean
}

/** Everything that happened in one visit: notes, treatments, Rx, timings. */
export function VisitDetailSheet({
  patientId,
  encounterId,
  visit,
  onClose,
  hideAmounts = false,
}: VisitDetailSheetProps) {
  const q = useEncounterDetail(encounterId)
  const encounter = q.data

  return (
    <Sheet open={!!encounterId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {q.isLoading ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Visit details</SheetTitle>
              <SheetDescription>Loading visit</SheetDescription>
            </SheetHeader>
            <div className="p-6">
              <LoadingSkeleton variant="detail" />
            </div>
          </>
        ) : q.isError || !encounter ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Visit details</SheetTitle>
              <SheetDescription>Could not load the visit</SheetDescription>
            </SheetHeader>
            <div className="p-6">
              <ErrorState onRetry={() => void q.refetch()} />
            </div>
          </>
        ) : (
          <VisitBody
            patientId={patientId}
            encounter={encounter}
            visit={visit}
            hideAmounts={hideAmounts}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function VisitBody({
  patientId,
  encounter,
  visit,
  hideAmounts,
}: {
  patientId: string
  encounter: Encounter
  visit?: PatientVisit
  hideAmounts: boolean
}) {
  const date = new Date(encounter.encounterDate)
  const treatments = encounter.treatments ?? []
  const total = treatments.reduce((s, t) => s + num(t.cost), 0)
  const title =
    encounter.diagnosis ||
    encounter.chiefComplaint ||
    encounter.reason ||
    'Visit'
  const appt = encounter.appointment

  const notes = [
    { label: 'Chief complaint', value: encounter.chiefComplaint },
    { label: 'Examination', value: encounter.examination },
    { label: 'Diagnosis', value: encounter.diagnosis },
    { label: 'Advice', value: encounter.advice },
  ].filter((n) => n.value?.trim())

  return (
    <>
      <SheetHeader className="border-b px-6 py-5 pr-12">
        <div className="flex items-start gap-3">
          <DateBlock date={date} highlight />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SheetTitle className="text-lg leading-snug">{title}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3" />
                {date.toLocaleDateString([], { dateStyle: 'medium' })} ·{' '}
                {timeOf(date)}
              </span>
              {visit?.doctorName && (
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="size-3" /> Dr. {visit.doctorName}
                </span>
              )}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-1.5">
              {appt ? (
                <Chip className={CHIP_TONES.info}>
                  <span className="capitalize">
                    {appt.type.replace(/_/g, ' ')}
                  </span>
                </Chip>
              ) : (
                <Chip className={CHIP_TONES.walkIn}>
                  <Footprints className="size-2.5" /> Walk-in
                </Chip>
              )}
              {visit && (
                <Chip className={CHIP_TONES.muted}>
                  {ENTRY_STATUS_LABELS[visit.status]}
                </Chip>
              )}
              {visit?.token && (
                <Chip className="border-primary/20 font-mono font-bold text-primary">
                  {visit.token}
                </Chip>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="space-y-6 px-6 py-5">
        {encounter.reason && (
          <p className="rounded-lg border border-border bg-panel px-3 py-2 text-sm italic text-text-2">
            “{encounter.reason}”
          </p>
        )}

        <DetailSection icon={NotebookPen} title="Doctor's notes">
          {notes.length === 0 && !encounter.followUpDate ? (
            <p className="text-sm italic text-muted-foreground">
              No notes were written for this visit.
            </p>
          ) : (
            <div className="space-y-3 rounded-lg border border-border p-3">
              {notes.map((n) => (
                <div key={n.label}>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {n.label}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{n.value}</p>
                </div>
              ))}
              {encounter.followUpDate && (
                <Chip className={CHIP_TONES.warning}>
                  <CalendarClock className="size-3" /> Follow-up{' '}
                  {new Date(encounter.followUpDate).toLocaleDateString([], {
                    dateStyle: 'medium',
                  })}
                </Chip>
              )}
            </div>
          )}
        </DetailSection>

        <DetailSection
          icon={Syringe}
          title="Treatments"
          count={treatments.length}
          action={
            !hideAmounts && (
              <Can perm="patients.clinical.edit">
                <TreatmentFormDialog
                  patientId={patientId}
                  encounterId={encounter.id}
                  trigger={
                    <Button size="sm" variant="outline" className="h-7">
                      <Plus className="size-3.5" /> Add treatment
                    </Button>
                  }
                />
              </Can>
            )
          }
        >
          {treatments.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              No treatments recorded for this visit.
            </p>
          ) : (
            <div className="divide-y rounded-lg border border-border">
              {treatments.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.treatmentName}
                    </p>
                    {t.notes && (
                      <p className="truncate text-xs text-muted-foreground">
                        {t.notes}
                      </p>
                    )}
                  </div>
                  {!hideAmounts && t.cost != null && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(num(t.cost))}
                    </span>
                  )}
                </div>
              ))}
              {!hideAmounts && total > 0 && (
                <div className="flex items-center justify-between bg-panel px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(total)}
                  </span>
                </div>
              )}
            </div>
          )}
        </DetailSection>

        <VisitPrescriptions encounterId={encounter.id} />

        {visit && (
          <DetailSection icon={History} title="Timeline">
            <Timeline
              steps={[
                { label: 'Arrived (checked in)', at: visit.checkedInAt },
                { label: 'Called in', at: visit.calledAt },
                {
                  label: 'Consultation started',
                  at: visit.consultationStartedAt,
                },
                {
                  label:
                    visit.status === 'completed'
                      ? 'Consultation finished'
                      : `Left (${ENTRY_STATUS_LABELS[visit.status]})`,
                  at: visit.finishedAt,
                  tone: visit.status === 'completed' ? undefined : 'danger',
                },
              ]}
            />
          </DetailSection>
        )}
      </div>
    </>
  )
}

function VisitPrescriptions({ encounterId }: { encounterId: string }) {
  const q = usePrescriptionsByEncounter(encounterId)
  const list = q.data ?? []
  return (
    <DetailSection
      icon={ClipboardList}
      title="Prescriptions"
      count={list.length}
    >
      {q.isLoading ? (
        <LoadingSkeleton variant="table" rows={2} />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : list.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          No prescription was written in this visit.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((rx) => (
            <div key={rx.id} className="rounded-lg border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-panel px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-3.5 shrink-0 text-primary" />
                  <span className="font-mono text-xs font-semibold">
                    {rx.prescriptionNumber}
                  </span>
                  <PrescriptionStatusBadge status={rx.status} />
                </div>
                <Button variant="ghost" size="sm" className="h-7" asChild>
                  <Link
                    to={'/prescriptions/$prescriptionId' as any}
                    params={{ prescriptionId: rx.id } as any}
                  >
                    Open <ExternalLink className="size-3" />
                  </Link>
                </Button>
              </div>
              {rx.medicines.length === 0 ? (
                <p className="px-3 py-2 text-xs italic text-muted-foreground">
                  No medicines.
                </p>
              ) : (
                <ul className="divide-y">
                  {rx.medicines.map((m, i) => (
                    <li key={m.id ?? i} className="px-3 py-2">
                      <p className="text-sm font-medium">{m.medicineName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[m.dosage, m.frequency, m.duration]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </DetailSection>
  )
}
