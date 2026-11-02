import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
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
import { Button } from '@/components/ui/button'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { usePatientStore } from '@/store/patient-store'
import { useAppointments } from '@/features/appointments'
import { usePatientVisits } from '@/features/queue'
import {
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  ChevronRight,
  Clock,
  Footprints,
  Stethoscope,
  Zap,
} from 'lucide-react'
import { usePatientHistory } from '../../hooks/usePatientSubEntities'
import type { Encounter, Patient } from '../../types'
import { AppointmentDetailSheet } from './history/AppointmentDetailSheet'
import { VisitDetailSheet } from './history/VisitDetailSheet'
import { buildApptRows, findEncounter } from './history/appointmentRows'
import type { ApptRow } from './history/appointmentRows'
import {
  CHIP_TONES,
  Chip,
  DateBlock,
  HistorySearch,
} from './history/HistoryParts'
import { formatDate } from '@/lib/datetime'

type When = 'all' | 'upcoming' | 'past'

const WHEN_OPTIONS: { value: When; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'History' },
]

export function AppointmentsTab({ patient }: { patient: Patient }) {
  const appts = useAppointments({ patientId: patient.id, limit: 100 })
  const visitsQ = usePatientVisits(patient.id)
  const { data: history } = usePatientHistory(patient.id)
  const encounters = history?.encounters ?? []

  const { historyViewMode: view, setHistoryViewMode } = usePatientStore()
  const [when, setWhen] = useState<When>('all')
  const [search, setSearch] = useState('')
  const term = useDebounce(search, 300).trim().toLowerCase()
  const [selected, setSelected] = useState<ApptRow | null>(null)
  const [visitOf, setVisitOf] = useState<{
    encounter: Encounter
    row: ApptRow
  } | null>(null)

  const rows = useMemo(
    () => buildApptRows(appts.data?.data ?? [], visitsQ.data ?? []),
    [appts.data, visitsQ.data],
  )
  const upcomingCount = rows.filter((r) => r.upcoming).length

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (when === 'all' || r.upcoming === (when === 'upcoming')) &&
          (!term ||
            [r.typeLabel, r.doctor ?? '', r.reason ?? '', r.statusLabel]
              .join(' ')
              .toLowerCase()
              .includes(term)),
      ),
    [rows, when, term],
  )
  const filterCount = (when !== 'all' ? 1 : 0) + (term ? 1 : 0)
  const clearFilters = () => {
    setWhen('all')
    setSearch('')
  }

  const columns = useMemo<ColumnDef<ApptRow, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        accessorFn: (r) => r.at.getTime(),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium">{formatDate(row.original.at)}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.timeLabel}
            </p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (r) => r.typeLabel,
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium capitalize">
              {row.original.typeLabel}
            </span>
            <KindChips row={row.original} />
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
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.statusLabel,
        cell: ({ row }) => (
          <Chip className={row.original.statusClass}>
            {row.original.statusLabel}
          </Chip>
        ),
      },
      {
        id: 'token',
        header: 'Token',
        accessorFn: (r) => r.token ?? '',
        cell: ({ row }) =>
          row.original.token ? (
            <span className="font-mono text-sm font-bold text-primary">
              {row.original.token}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'reason',
        header: 'Reason',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-sm text-text-2">
            {row.original.reason || '—'}
          </span>
        ),
      },
      {
        id: 'open',
        header: '',
        enableSorting: false,
        cell: () => (
          <ChevronRight className="ml-auto size-4 text-muted-foreground" />
        ),
      },
    ],
    [],
  )

  const isLoading = appts.isLoading || visitsQ.isLoading
  const isError = appts.isError || visitsQ.isError
  const upcoming = filtered.filter((r) => r.upcoming)
  const past = filtered.filter((r) => !r.upcoming)

  return (
    <div className="mt-4 space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="text-primary" size={20} />
            Appointments
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rows.length === 0
              ? 'No appointments or visits on record for this patient.'
              : `${upcomingCount} upcoming · ${rows.length - upcomingCount} past — click one for details`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={setHistoryViewMode} size="sm" />
          <Button asChild size="sm">
            <Link to="/appointments" search={{ create: '1' }}>
              <CalendarPlus className="size-3.5" />
              Book appointment
            </Link>
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="When"
            className="inline-flex items-center gap-0.5 rounded-[9px] border border-border bg-panel p-[2px]"
          >
            {WHEN_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="tab"
                aria-selected={when === o.value}
                onClick={() => setWhen(o.value)}
                className={cn(
                  'h-7 rounded-[7px] px-3 text-xs font-medium transition-colors',
                  when === o.value
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-text-2 hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <HistorySearch
            value={search}
            onChange={setSearch}
            placeholder="Search doctor, reason, status…"
          />
          {filterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={clearFilters}
            >
              Clear all filters
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {filterCount}
              </span>
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton variant={view === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState
          onRetry={() => {
            void appts.refetch()
            void visitsQ.refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No appointments yet"
          description="Book this patient's first visit from the scheduler."
        />
      ) : filtered.length === 0 ? (
        <NoResultsState
          message="No appointments match your filters."
          onClear={clearFilters}
        />
      ) : view === 'table' ? (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={setSelected}
          defaultPageSize={10}
          getRowClassName={(r) =>
            r.upcoming ? 'bg-primary-soft/40' : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <Section title="Upcoming" count={upcoming.length}>
              {upcoming.map((r) => (
                <AppointmentCard
                  key={r.id}
                  row={r}
                  hasVisit={!!findEncounter(r, encounters)}
                  onOpen={() => setSelected(r)}
                />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="History" count={past.length}>
              {past.map((r) => (
                <AppointmentCard
                  key={r.id}
                  row={r}
                  hasVisit={!!findEncounter(r, encounters)}
                  onOpen={() => setSelected(r)}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      <AppointmentDetailSheet
        row={selected}
        encounter={selected ? findEncounter(selected, encounters) : undefined}
        onClose={() => setSelected(null)}
        onOpenVisit={(encounter) => {
          if (selected) setVisitOf({ encounter, row: selected })
          setSelected(null)
        }}
      />
      <VisitDetailSheet
        patientId={patient.id}
        encounterId={visitOf?.encounter.id ?? null}
        visit={
          visitOf?.row.visit ??
          visitsQ.data?.find((v) => v.id === visitOf?.encounter.queueEntryId)
        }
        onClose={() => setVisitOf(null)}
      />
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </div>
  )
}

function KindChips({ row }: { row: ApptRow }) {
  return (
    <>
      {row.kind === 'walk_in' && (
        <Chip className={CHIP_TONES.walkIn}>
          <Footprints className="size-2.5" /> Walk-in
        </Chip>
      )}
      {row.emergency && (
        <Chip className={CHIP_TONES.emergency}>
          <Zap className="size-2.5" /> Emergency
        </Chip>
      )}
    </>
  )
}

function AppointmentCard({
  row,
  hasVisit,
  onOpen,
}: {
  row: ApptRow
  hasVisit: boolean
  onOpen: () => void
}) {
  const faded =
    row.statusLabel === 'Cancelled' ||
    row.statusLabel === 'No Show' ||
    row.visit?.status === 'aborted'
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
      className={cn(
        'group cursor-pointer gap-0 p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        faded && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <DateBlock date={row.at} highlight={row.upcoming} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold capitalize">
              {row.typeLabel}
            </span>
            <Chip className={row.statusClass}>{row.statusLabel}</Chip>
            <KindChips row={row} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {row.timeLabel}
            </span>
            {row.doctor && (
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="size-3" />
                Dr. {row.doctor}
              </span>
            )}
          </p>
          {row.reason && (
            <p className="mt-1 truncate text-xs italic text-muted-foreground">
              “{row.reason}”
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              'font-mono text-sm font-bold tabular-nums',
              row.token ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {row.token ?? '—'}
          </span>
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      {hasVisit && (
        <p className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2 text-xs font-medium text-emerald">
          <CalendarCheck2 className="size-3.5" /> Visit recorded — tap to see
          what was done
        </p>
      )}
    </Card>
  )
}
