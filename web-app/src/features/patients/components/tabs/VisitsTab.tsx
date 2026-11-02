import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
  ViewToggle,
} from '@/components/shared'
import { Card } from '@/components/ui/card'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { usePatientStore } from '@/store/patient-store'
import { usePatientVisits } from '@/features/queue'
import type { PatientVisit } from '@/features/queue'
import {
  CalendarCheck2,
  ChevronRight,
  Clock,
  Footprints,
  Stethoscope,
  Syringe,
} from 'lucide-react'
import { usePatientHistory } from '../../hooks/usePatientSubEntities'
import type { Patient, Encounter } from '../../types'
import { VisitDetailSheet } from './history/VisitDetailSheet'
import {
  CHIP_TONES,
  Chip,
  DateBlock,
  HistorySearch,
  num,
  timeOf,
} from './history/HistoryParts'
import { formatDate } from '@/lib/datetime'

interface VisitRow {
  encounter: Encounter
  visit?: PatientVisit
  date: Date
  title: string
  doctor: string | null
  total: number
  treatments: string[]
}

export function VisitsTab({
  patient,
  hideAmounts = false,
  compact = false,
}: {
  patient: Patient
  /** Clinical-only view (doctor's consultation): no fees anywhere. */
  hideAmounts?: boolean
  /** Narrow container (consultation drawer): cards only, no view toggle. */
  compact?: boolean
}) {
  const history = usePatientHistory(patient.id)
  const { data: visits = [] } = usePatientVisits(patient.id)
  const { historyViewMode, setHistoryViewMode } = usePatientStore()
  const view = compact ? 'card' : historyViewMode
  const [search, setSearch] = useState('')
  const term = useDebounce(search, 300).trim().toLowerCase()
  const [selected, setSelected] = useState<VisitRow | null>(null)

  const rows = useMemo<VisitRow[]>(() => {
    const byEntry = new Map(visits.map((v) => [v.id, v]))
    return (history.data?.encounters ?? []).map((enc) => {
      const visit = byEntry.get(enc.queueEntryId)
      const treatments = enc.treatments ?? []
      return {
        encounter: enc,
        visit,
        date: new Date(enc.encounterDate),
        title: enc.diagnosis || enc.chiefComplaint || enc.reason || 'Visit',
        doctor: visit?.doctorName ?? null,
        total: treatments.reduce((s, t) => s + num(t.cost), 0),
        treatments: treatments.map((t) => t.treatmentName),
      }
    })
  }, [history.data, visits])

  const filtered = useMemo(
    () =>
      term
        ? rows.filter((r) =>
            [r.title, r.doctor ?? '', ...r.treatments]
              .join(' ')
              .toLowerCase()
              .includes(term),
          )
        : rows,
    [rows, term],
  )

  const columns = useMemo<ColumnDef<VisitRow, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        accessorFn: (r) => r.date.getTime(),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">
              {formatDate(row.original.date)}
            </p>
            <p className="text-xs text-muted-foreground">
              {timeOf(row.original.date)}
            </p>
          </div>
        ),
      },
      {
        id: 'title',
        header: 'Diagnosis / complaint',
        accessorFn: (r) => r.title,
        cell: ({ row }) => (
          <div className="max-w-[260px]">
            <p className="truncate text-sm font-medium">{row.original.title}</p>
            <SourceChip row={row.original} />
          </div>
        ),
      },
      {
        id: 'doctor',
        header: 'Doctor',
        accessorFn: (r) => r.doctor ?? '',
        cell: ({ row }) =>
          row.original.doctor ? (
            <span className="text-sm">Dr. {row.original.doctor}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'treatments',
        header: 'Treatments',
        accessorFn: (r) => r.treatments.length,
        cell: ({ row }) => (
          <span
            className="block max-w-[220px] truncate text-sm text-text-2"
            title={row.original.treatments.join(', ')}
          >
            {row.original.treatments.length === 0
              ? '—'
              : row.original.treatments.join(', ')}
          </span>
        ),
      },
      ...(hideAmounts
        ? []
        : [
            {
              id: 'total',
              header: 'Amount',
              accessorFn: (r: VisitRow) => r.total,
              cell: ({ row }: { row: { original: VisitRow } }) =>
                row.original.total > 0 ? (
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(row.original.total)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            } as ColumnDef<VisitRow, unknown>,
          ]),
      {
        id: 'open',
        header: '',
        enableSorting: false,
        cell: () => (
          <ChevronRight className="ml-auto size-4 text-muted-foreground" />
        ),
      },
    ],
    [hideAmounts],
  )

  return (
    <div className="mt-4 space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarCheck2 className="text-primary" size={20} />
            Visits
            {rows.length > 0 && (
              <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {rows.length}
              </span>
            )}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Recorded when the doctor sees the patient. Click a visit to see what
            was done.
          </p>
        </div>
        {!compact && (
          <ViewToggle value={view} onChange={setHistoryViewMode} size="sm" />
        )}
      </div>

      {rows.length > 0 && (
        <HistorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search diagnosis, doctor, treatment…"
        />
      )}

      {history.isLoading ? (
        <LoadingSkeleton variant={view === 'table' ? 'table' : 'cards'} />
      ) : history.isError ? (
        <ErrorState onRetry={() => void history.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="No visits yet"
          description="A visit is recorded when the patient is seen by a doctor."
        />
      ) : filtered.length === 0 ? (
        <NoResultsState
          message="No visits match your search."
          onClear={() => setSearch('')}
        />
      ) : view === 'table' ? (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={setSelected}
          defaultPageSize={10}
        />
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-3',
            !compact && 'md:grid-cols-2 xl:grid-cols-3',
          )}
        >
          {filtered.map((r) => (
            <VisitCard
              key={r.encounter.id}
              row={r}
              hideAmounts={hideAmounts}
              onOpen={() => setSelected(r)}
            />
          ))}
        </div>
      )}

      <VisitDetailSheet
        patientId={patient.id}
        encounterId={selected?.encounter.id ?? null}
        visit={selected?.visit}
        onClose={() => setSelected(null)}
        hideAmounts={hideAmounts}
      />
    </div>
  )
}

function SourceChip({ row }: { row: VisitRow }) {
  const appt = row.encounter.appointmentId
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {appt ? (
        <Chip className={CHIP_TONES.info}>Appointment</Chip>
      ) : (
        <Chip className={CHIP_TONES.walkIn}>
          <Footprints className="size-2.5" /> Walk-in
        </Chip>
      )}
      {row.visit?.token && (
        <Chip className="border-primary/20 font-mono font-bold text-primary">
          {row.visit.token}
        </Chip>
      )}
    </span>
  )
}

function VisitCard({
  row,
  hideAmounts,
  onOpen,
}: {
  row: VisitRow
  hideAmounts: boolean
  onOpen: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group cursor-pointer gap-0 p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <DateBlock date={row.date} highlight />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{row.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {timeOf(row.date)}
            </span>
            {row.doctor && (
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="size-3" /> Dr. {row.doctor}
              </span>
            )}
          </p>
          <SourceChip row={row} />
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-text-2">
          <Syringe className="size-3 shrink-0" />
          <span className="truncate">
            {row.treatments.length === 0
              ? 'No treatments'
              : row.treatments.join(', ')}
          </span>
        </p>
        {!hideAmounts && row.total > 0 && (
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(row.total)}
          </span>
        )}
      </div>
    </Card>
  )
}
