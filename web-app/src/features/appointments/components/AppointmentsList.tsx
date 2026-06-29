import { useCallback, useEffect, useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  MoreHorizontal,
  Pencil,
  LogIn,
  Stethoscope,
  CheckCircle,
  ThumbsUp,
  UserX,
  XCircle,
  Plus,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
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
import { cn } from '@/lib/utils'
import { AppointmentsToolbar } from './AppointmentsToolbar'
import { AppointmentFilters } from './AppointmentFilters'
import { useAppointments } from '../hooks/useAppointments'
import { useDoctors } from '../hooks/useDoctors'
import {
  useCancelAppointment,
  useCheckIn,
  useStartAppointment,
  useCompleteAppointment,
  useConfirmAppointment,
  useNoShow,
} from '../hooks/useAppointmentActions'
import { useAppointmentStore } from '@/store/appointment-store'
import {
  type Appointment,
  AppointmentStatus,
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

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function resolveRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { startDate?: string; endDate?: string } {
  if (preset === 'all') return {}
  if (preset === 'today') {
    const now = new Date()
    return {
      startDate: startOfDay(now).toISOString(),
      endDate: endOfDay(now).toISOString(),
    }
  }
  if (preset === 'upcoming') {
    return { startDate: startOfDay(new Date()).toISOString() }
  }
  if (preset === 'past30') {
    const end = endOfDay(new Date())
    const start = startOfDay(new Date())
    start.setDate(start.getDate() - 30)
    return { startDate: start.toISOString(), endDate: end.toISOString() }
  }
  return {
    startDate: customFrom
      ? startOfDay(new Date(customFrom)).toISOString()
      : undefined,
    endDate: customTo
      ? endOfDay(new Date(customTo)).toISOString()
      : undefined,
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

  const cancelMutation = useCancelAppointment()
  const noShowMutation = useNoShow()
  const checkInMutation = useCheckIn()
  const startMutation = useStartAppointment()
  const completeMutation = useCompleteAppointment()
  const confirmMutation = useConfirmAppointment()

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
    type: type !== 'all' ? (type as any) : undefined,
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
      ? new Date(customFrom + 'T12:00:00')
      : null

  const handleStripSelect = (d: Date) => {
    const ymd = toYMD(d)
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

  // ─── Columns ─────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Appointment, unknown>[]>(
    () => [
      {
        id: 'token',
        accessorKey: 'tokenNumber',
        header: 'Token',
        cell: ({ row }) => {
          const appt = row.original
          return appt.tokenNumber != null ? (
            <span className="inline-flex h-7 min-w-[44px] items-center justify-center rounded-md bg-primary/10 px-2 text-sm font-bold tabular-nums text-primary">
              #{appt.tokenNumber}
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
          const start = new Date(row.original.startTime)
          const end = new Date(row.original.endTime)
          return (
            <div className="font-medium">
              <div>
                {start.toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {start.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                –{' '}
                {end.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
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
                {appt.isWalkIn && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    Walk-in
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
        cell: ({ row }) => (
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
          const isCancelled = appt.status === AppointmentStatus.CANCELLED
          const isCompleted = appt.status === AppointmentStatus.COMPLETED
          const isNoShow = appt.status === AppointmentStatus.NO_SHOW
          const isTerminal = isCancelled || isCompleted || isNoShow
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
                  <DropdownMenuItem onClick={() => openEditModal(appt.id)}>
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  {!isTerminal && (
                    <>
                      <DropdownMenuSeparator />
                      {(appt.status === AppointmentStatus.SCHEDULED ||
                        appt.status === AppointmentStatus.RESCHEDULED) && (
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
                      {(appt.status === AppointmentStatus.SCHEDULED ||
                        appt.status === AppointmentStatus.CONFIRMED ||
                        appt.status === AppointmentStatus.RESCHEDULED) && (
                        <DropdownMenuItem
                          onClick={() =>
                            handle('checked in', () =>
                              checkInMutation.mutateAsync(appt.id),
                            )
                          }
                        >
                          <LogIn className="w-3.5 h-3.5 mr-2" />
                          Check in
                        </DropdownMenuItem>
                      )}
                      {appt.status === AppointmentStatus.CHECKED_IN && (
                        <DropdownMenuItem
                          onClick={() =>
                            handle('started', () =>
                              startMutation.mutateAsync(appt.id),
                            )
                          }
                        >
                          <Stethoscope className="w-3.5 h-3.5 mr-2" />
                          Start consultation
                        </DropdownMenuItem>
                      )}
                      {appt.status === AppointmentStatus.IN_PROGRESS && (
                        <DropdownMenuItem
                          onClick={() =>
                            handle('completed', () =>
                              completeMutation.mutateAsync(appt.id),
                            )
                          }
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-2" />
                          Complete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
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
      handle,
      cancelMutation,
      noShowMutation,
      checkInMutation,
      startMutation,
      completeMutation,
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
                  <button
                    type="button"
                    onClick={() => setPreset('custom')}
                    className={cn(
                      'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                      preset === 'custom'
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    Custom
                  </button>
                </div>

                {/* Custom date range */}
                {preset === 'custom' && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">From</span>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="h-8 w-[130px] text-xs"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="h-8 w-[130px] text-xs"
                    />
                  </div>
                )}
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
        emptyMessage="No appointments match these filters."
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreateModal()}
            >
              <Plus className="w-4 h-4 mr-2" />
              New appointment
            </Button>
          </div>
        }
        onRowClick={(appt) => openDetailModal(appt.id)}
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
    </div>
  )
}
