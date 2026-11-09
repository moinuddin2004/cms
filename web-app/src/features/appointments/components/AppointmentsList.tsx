import { useCallback, useEffect, useMemo, useState } from 'react'
import { Can } from '@/features/access'
import type { ColumnDef } from '@/components/shared/table-features'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import {
  MoreHorizontal,
  UserRound,
  Pencil,
  LogIn,
  ThumbsUp,
  UserX,
  XCircle,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable } from '@/components/shared/DataTable'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { subDays } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  clinicDayBounds,
  dateToYmd,
  formatDate,
  formatInClinic,
  todayYmd,
  ymdToDate,
} from '@/lib/datetime'
import { AppointmentsToolbar } from './AppointmentsToolbar'
import { AppointmentFilters } from './AppointmentFilters'
import { useAppointments } from '../hooks/useAppointments'
import { useDoctors } from '../hooks/useDoctors'
import {
  useCancelAppointment,
  useConfirmAppointment,
  useNoShow,
} from '../hooks/useAppointmentActions'
import { CheckInDialog } from '@/features/queue'
import type { CheckInTarget } from '@/features/queue'
import { useAppointmentStore } from '@/store/appointment-store'
import type {
  AppointmentListParams,
  type Appointment,
  AppointmentStatus,
  NOT_ARRIVED_STATUSES,
  QUEUE_STATUS_LABELS,
  STATUS_BG_COLORS,
} from '../types'

// ─── Date preset helpers ──────────────────────────────────────────────

type DatePreset = 'today' | 'upcoming' | 'past30' | 'all' | 'custom'

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past30', label: 'Past 30 days' },
  { value: 'all', label: 'All' },
]

/** Preset / custom range → UTC bounds of the CLINIC's calendar days. */
function resolveRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { startDate?: string; endDate?: string } {
  if (preset === 'all') return {}
  const today = todayYmd()
  if (preset === 'today') {
    const { start, end } = clinicDayBounds(today)
    return { startDate: start, endDate: end }
  }
  if (preset === 'upcoming') {
    return { startDate: clinicDayBounds(today).start }
  }
  if (preset === 'past30') {
    const from = dateToYmd(subDays(ymdToDate(today), 30))
    return {
      startDate: clinicDayBounds(from).start,
      endDate: clinicDayBounds(today).end,
    }
  }
  return {
    startDate: customFrom ? clinicDayBounds(customFrom).start : undefined,
    endDate: customTo ? clinicDayBounds(customTo).end : undefined,
  }
}

// ─── Component ────────────────────────────────────────────────────────

export function AppointmentsList() {
  const {
    openCreateModal,
    openDetailModal,
    openEditModal,
    doctorFilter,
    setDoctorFilter,
  } = useAppointmentStore()
  const { data: doctors = [] } = useDoctors()
  const navigate = useNavigate()

  const cancelMutation = useCancelAppointment()
  const noShowMutation = useNoShow()
  const confirmMutation = useConfirmAppointment()
  const [checkInTarget, setCheckInTarget] = useState<CheckInTarget | null>(null)

  // ─── Filter + pagination state ───────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [preset, setPreset] = useState<DatePreset>('upcoming')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, status, type, doctorFilter, preset, customFrom, customTo])

  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )

  const { data, isLoading, isFetching } = useAppointments({
    ...range,
    status: status !== 'all' ? (status as AppointmentStatus) : undefined,
    type: type !== 'all' ? (type as AppointmentListParams['type']) : undefined,
    includeWalkIns: true,
    doctorId: doctorFilter !== 'all' ? doctorFilter : undefined,
    search: search || undefined,
    page,
    limit: pageSize,
  })

  const appointments = data?.data ?? []
  const total = data?.total ?? 0

  const hasActiveFilters =
    !!search ||
    status !== 'all' ||
    type !== 'all' ||
    doctorFilter !== 'all' ||
    preset !== 'upcoming'

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatus('all')
    setType('all')
    setDoctorFilter('all')
    setPreset('upcoming')
    setCustomFrom('')
    setCustomTo('')
  }

  // The day strip drives a single-day custom range; clicking a preset clears
  // the strip highlight.
  const stripDate =
    preset === 'custom' && customFrom && customFrom === customTo
      ? ymdToDate(customFrom)
      : null

  const handleStripSelect = (d: Date) => {
    const ymd = dateToYmd(d)
    setPreset('custom')
    setCustomFrom(ymd)
    setCustomTo(ymd)
  }

  const handle = useCallback(
    async (label: string, run: () => Promise<unknown>) => {
      try {
        await run()
        toast.success(`Appointment ${label}`)
      } catch (err: any) {
        toast.error(err?.response?.data?.message || `Failed to ${label}`)
      }
    },
    [],
  )

  const openPatient = useCallback(
    (patientId: string) =>
      void navigate({ to: '/patients/$patientId', params: { patientId } }),
    [navigate],
  )

  // ─── Columns ─────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Appointment, unknown>[]>(
    () => [
      {
        id: 'token',
        header: 'Token',
        enableSorting: false,
        cell: ({ row }) => {
          const entry = row.original.queueEntry
          return entry ? (
            <span
              className="inline-flex h-7 min-w-[44px] items-center justify-center rounded-md bg-primary/10 px-2 text-sm font-bold tabular-nums text-primary"
              title={QUEUE_STATUS_LABELS[entry.status]}
            >
              {entry.token}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )
        },
      },
      {
        id: 'datetime',
        accessorKey: 'startTime',
        header: 'Date & Time',
        cell: ({ row }) => {
          const { startTime, endTime } = row.original
          const isWalkIn = row.original.kind === 'walk_in'
          return (
            <div className="font-medium">
              <div>{formatDate(startTime)}</div>
              <div className="text-xs text-muted-foreground">
                {isWalkIn ? 'Arrived ' : ''}
                {formatInClinic(startTime, 'hh:mm a')}
                {/* A walk-in has no booked slot, so there is no end time. */}
                {!isWalkIn && <> – {formatInClinic(endTime, 'hh:mm a')}</>}
              </div>
            </div>
          )
        },
      },
      {
        id: 'patient',
        header: 'Patient',
        enableSorting: false,
        cell: ({ row }) => {
          const appt = row.original
          return (
            <div>
              <div className="font-medium truncate max-w-[200px]">
                {appt.patient?.fullName || 'Unknown'}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>{appt.patient?.phone || '—'}</span>
                {appt.isEmergency && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    Emergency
                  </Badge>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'doctor',
        header: 'Doctor',
        enableSorting: false,
        cell: ({ row }) => {
          const doctor = row.original.doctor
          return doctor?.fullName ? (
            <span className="text-sm">{`Dr. ${doctor.fullName}`}</span>
          ) : (
            <span className="text-muted-foreground italic text-sm">
              Unassigned
            </span>
          )
        },
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) =>
          row.original.kind === 'walk_in' ? (
            <Badge
              variant="outline"
              className="border-violet-200 bg-violet-50 text-violet-700"
            >
              Walk-in
            </Badge>
          ) : (
            <span className="text-sm capitalize">
              {row.original.type.replace('_', ' ')}
            </span>
          ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize',
              STATUS_BG_COLORS[row.original.status],
            )}
          >
            {row.original.status.replace('_', ' ')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const appt = row.original
          const isNotArrived = NOT_ARRIVED_STATUSES.includes(appt.status)
          if (appt.kind === 'walk_in') {
            // No booking to open, edit or cancel — queue actions live on the
            // Queue tab; from here the useful thing is the patient's record.
            return (
              <div onClick={(e) => e.stopPropagation()}>
                <TooltipButton
                  tooltip="Open patient"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openPatient(appt.patientId)}
                >
                  <UserRound className="w-4 h-4" />
                </TooltipButton>
              </div>
            )
          }
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {appt.patient?.fullName}
                  </DropdownMenuLabel>
                  {!isNotArrived && (
                    <DropdownMenuItem onClick={() => openDetailModal(appt.id)}>
                      View details
                    </DropdownMenuItem>
                  )}
                  {isNotArrived && (
                    <>
                      <Can perm="appointments.reschedule">
                        <DropdownMenuItem
                          onClick={() => openEditModal(appt.id)}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      </Can>
                      <DropdownMenuSeparator />
                      <Can perm="appointments.book">
                        {appt.status === AppointmentStatus.SCHEDULED && (
                          <DropdownMenuItem
                            onClick={() =>
                              handle('confirmed', () =>
                                confirmMutation.mutateAsync(appt.id),
                              )
                            }
                          >
                            <ThumbsUp className="w-3.5 h-3.5 mr-2" />
                            Confirm
                          </DropdownMenuItem>
                        )}
                      </Can>
                      <Can perm="queue.checkin">
                        <DropdownMenuItem
                          onClick={() =>
                            setCheckInTarget({
                              id: appt.id,
                              patientName: appt.patient?.fullName,
                              doctorName: appt.doctor?.fullName,
                              startTime: appt.startTime,
                              isEmergency: appt.isEmergency,
                            })
                          }
                        >
                          <LogIn className="w-3.5 h-3.5 mr-2" />
                          Check in
                        </DropdownMenuItem>
                      </Can>
                      <DropdownMenuSeparator />
                      <Can perm="appointments.cancel">
                        <DropdownMenuItem
                          onClick={() =>
                            handle('marked no-show', () =>
                              noShowMutation.mutateAsync(appt.id),
                            )
                          }
                        >
                          <UserX className="w-3.5 h-3.5 mr-2" />
                          No show
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handle('cancelled', () =>
                              cancelMutation.mutateAsync({ id: appt.id }),
                            )
                          }
                        >
                          <XCircle className="w-3.5 h-3.5 mr-2" />
                          Cancel
                        </DropdownMenuItem>
                      </Can>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [
      openEditModal,
      openDetailModal,
      openPatient,
      handle,
      cancelMutation,
      noShowMutation,
      confirmMutation,
    ],
  )

  return (
    <div className="space-y-3">
      {/* ── Unified toolbar: day strip + doctor + search + filters ─ */}
      <AppointmentsToolbar
        selectedDate={stripDate}
        onSelectDate={handleStripSelect}
        doctors={doctors}
        doctorFilter={doctorFilter}
        onDoctorChange={setDoctorFilter}
        isFetching={isFetching && !isLoading}
        filters={
          <AppointmentFilters
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            status={status}
            onStatusChange={setStatus}
            type={type}
            onTypeChange={setType}
            hasActiveFilters={hasActiveFilters}
            onReset={clearFilters}
            count={total}
            countNoun="visit"
            includeWalkInType
            dateControls={
              <>
                {/* Date presets */}
                <div className="flex items-center gap-1">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPreset(p.value)}
                      className={cn(
                        'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                        preset === p.value
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Any other range (with its own quick presets) */}
                <DateRangePicker
                  aria-label="Custom date range"
                  className={cn(
                    'h-8 w-full sm:w-[240px] text-xs',
                    preset === 'custom' && 'border-primary',
                  )}
                  value={
                    preset === 'custom'
                      ? { from: customFrom, to: customTo }
                      : {}
                  }
                  onChange={(r) => {
                    if (!r.from) {
                      setPreset('upcoming')
                      return
                    }
                    setCustomFrom(r.from)
                    setCustomTo(r.to)
                    setPreset('custom')
                  }}
                  placeholder="Custom range"
                />
              </>
            }
          />
        }
      />

      {/* ── Table + built-in pagination ─────────────────────────── */}
      <DataTable
        columns={columns}
        data={appointments}
        isLoading={isLoading}
        skeletonRows={pageSize}
        emptyMessage="No appointments or walk-ins match these filters."
        emptyAction={
          <div className="flex flex-col items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="link"
                size="sm"
                onClick={clearFilters}
                className="h-6"
              >
                Clear filters
              </Button>
            )}
            <Can perm="appointments.book">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreateModal()}
              >
                <Plus className="w-4 h-4 mr-2" />
                New appointment
              </Button>
            </Can>
          </div>
        }
        onRowClick={(appt) =>
          appt.kind === 'walk_in'
            ? openPatient(appt.patientId)
            : openDetailModal(appt.id)
        }
        getRowClassName={(appt) =>
          appt.status === AppointmentStatus.CANCELLED ? 'opacity-50' : undefined
        }
        serverPagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: (s) => {
            setPageSize(s)
            setPage(1)
          },
          pageSizeOptions: [10, 25, 50, 100],
        }}
      />
      <CheckInDialog
        target={checkInTarget}
        onOpenChange={(o) => !o && setCheckInTarget(null)}
      />
    </div>
  )
}
