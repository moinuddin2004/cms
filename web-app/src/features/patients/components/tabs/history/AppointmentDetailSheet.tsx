import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ENTRY_STATUS_LABELS } from '@/features/queue'
import {
  CalendarCheck2,
  ChevronRight,
  Clock,
  Footprints,
  History,
  Info,
  MessageSquareText,
  Stethoscope,
  Zap,
} from 'lucide-react'
import type { Encounter } from '../../../types'
import type { ApptRow } from './appointmentRows'
import {
  CHIP_TONES,
  Chip,
  DateBlock,
  DetailSection,
  InfoItem,
  Timeline,
  timeOf,
} from './HistoryParts'

interface AppointmentDetailSheetProps {
  row: ApptRow | null
  /** The visit this appointment turned into, if the doctor has seen them. */
  encounter?: Encounter
  onOpenVisit: (encounter: Encounter) => void
  onClose: () => void
}

/** Booking info, queue progress and a link to the visit it led to. */
export function AppointmentDetailSheet({
  row,
  encounter,
  onOpenVisit,
  onClose,
}: AppointmentDetailSheetProps) {
  return (
    <Sheet open={!!row} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {row && (
          <Body row={row} encounter={encounter} onOpenVisit={onOpenVisit} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function Body({
  row,
  encounter,
  onOpenVisit,
}: {
  row: ApptRow
  encounter?: Encounter
  onOpenVisit: (encounter: Encounter) => void
}) {
  const { appt, visit } = row
  const queue = appt?.queueEntry ?? null
  const steps = appt
    ? [
        { label: 'Booked', at: appt.createdAt },
        { label: 'Checked in', at: appt.checkedInAt },
        { label: 'Completed', at: appt.completedAt },
        { label: 'Cancelled', at: appt.cancelledAt, tone: 'danger' as const },
        { label: 'Marked no-show', at: appt.noShowAt, tone: 'danger' as const },
      ]
    : [
        { label: 'Arrived (walk-in)', at: visit?.checkedInAt },
        { label: 'Called in', at: visit?.calledAt },
        { label: 'Consultation started', at: visit?.consultationStartedAt },
        {
          label:
            visit?.status === 'completed'
              ? 'Consultation finished'
              : 'Left the queue',
          at: visit?.finishedAt,
          tone: visit?.status === 'completed' ? undefined : ('danger' as const),
        },
      ]

  return (
    <>
      <SheetHeader className="border-b px-6 py-5 pr-12">
        <div className="flex items-start gap-3">
          <DateBlock date={row.at} highlight={row.upcoming} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SheetTitle className="text-lg capitalize leading-snug">
              {row.typeLabel}
            </SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {row.at.toLocaleDateString([], { dateStyle: 'medium' })} ·{' '}
                {row.timeLabel}
              </span>
              {row.doctor && (
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="size-3" /> Dr. {row.doctor}
                </span>
              )}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.kind === 'walk_in' && (
                <Chip className={CHIP_TONES.walkIn}>
                  <Footprints className="size-2.5" /> Walk-in
                </Chip>
              )}
              <Chip className={row.statusClass}>{row.statusLabel}</Chip>
              {row.emergency && (
                <Chip className={CHIP_TONES.emergency}>
                  <Zap className="size-2.5" /> Emergency
                </Chip>
              )}
            </div>
          </div>
        </div>
      </SheetHeader>

      <div className="space-y-6 px-6 py-5">
        <DetailSection icon={Info} title="Details">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border p-3">
            <InfoItem label="Date">
              {row.at.toLocaleDateString([], {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </InfoItem>
            <InfoItem label="Time">{row.timeLabel}</InfoItem>
            <InfoItem label="Doctor">
              {row.doctor ? `Dr. ${row.doctor}` : '—'}
            </InfoItem>
            {appt ? (
              <InfoItem label="Duration">{appt.durationMinutes} min</InfoItem>
            ) : (
              <InfoItem label="Arrived">{timeOf(row.at)}</InfoItem>
            )}
            <InfoItem label="Token">
              {row.token ? (
                <span className="font-mono font-bold text-primary">
                  {row.token}
                </span>
              ) : (
                <span className="text-muted-foreground">Not arrived</span>
              )}
            </InfoItem>
            <InfoItem label="Queue status">
              {queue
                ? ENTRY_STATUS_LABELS[queue.status]
                : visit
                  ? ENTRY_STATUS_LABELS[visit.status]
                  : '—'}
            </InfoItem>
          </div>
        </DetailSection>

        {(row.reason || appt?.notes || appt?.cancelReason) && (
          <DetailSection icon={MessageSquareText} title="Reason & notes">
            <div className="space-y-2">
              {row.reason && (
                <p className="rounded-lg border border-border bg-panel px-3 py-2 text-sm italic text-text-2">
                  “{row.reason}”
                </p>
              )}
              {appt?.notes && (
                <p className="whitespace-pre-wrap rounded-lg border border-border px-3 py-2 text-sm">
                  {appt.notes}
                </p>
              )}
              {appt?.cancelReason && (
                <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  Cancelled: {appt.cancelReason}
                </p>
              )}
            </div>
          </DetailSection>
        )}

        <DetailSection icon={CalendarCheck2} title="Visit">
          {encounter ? (
            <button
              type="button"
              onClick={() => onOpenVisit(encounter)}
              className="group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-panel"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {encounter.diagnosis ||
                    encounter.chiefComplaint ||
                    'Visit recorded'}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {(encounter.treatments?.length ?? 0) === 0
                    ? 'No treatments'
                    : encounter
                        .treatments!.map((t) => t.treatmentName)
                        .join(', ')}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
                View visit
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              {row.upcoming
                ? 'The visit will appear here once the doctor sees the patient.'
                : 'No visit was recorded for this appointment.'}
            </p>
          )}
        </DetailSection>

        <DetailSection icon={History} title="Timeline">
          <Timeline steps={steps} />
        </DetailSection>
      </div>
    </>
  )
}
