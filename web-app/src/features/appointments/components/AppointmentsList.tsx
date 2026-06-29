import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Search,
  X,
  CalendarDays,
  Loader2,
  MoreHorizontal,
  Pencil,
  LogIn,
  Stethoscope,
  CheckCircle,
  ThumbsUp,
  UserX,
  XCircle,
  RotateCcw,
  Plus,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Pagination } from '@/components/shared'
import { cn } from '@/lib/utils'
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
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
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
  // custom
  return {
    startDate: customFrom ? startOfDay(new Date(customFrom)).toISOString() : undefined,
    endDate: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined,
  }
}

// ─── Component ────────────────────────────────────────────────────────

export function AppointmentsList() {
  const { openCreateModal, openDetailModal, openEditModal } = useAppointmentStore()
  const { data: doctors = [] } = useDoctors()

  const cancelMutation = useCancelAppointment()
  const noShowMutation = useNoShow()
  const checkInMutation = useCheckIn()
  const startMutation = useStartAppointment()
  const completeMutation = useCompleteAppointment()
  const confirmMutation = useConfirmAppointment()

  // ─── Filter state ────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [doctorId, setDoctorId] = useState<string>('all')
  const [preset, setPreset] = useState<DatePreset>('upcoming')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Any filter change resets pagination.
  useEffect(() => {
    setPage(1)
  }, [search, status, type, doctorId, preset, customFrom, customTo])

  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )

  const { data, isLoading, isFetching } = useAppointments({
    ...range,
    status: status !== 'all' ? (status as AppointmentStatus) : undefined,
    type: type !== 'all' ? (type as any) : undefined,
    doctorId: doctorId !== 'all' ? doctorId : undefined,
    search: search || undefined,
    page,
    limit,
  })

  const appointments = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const hasActiveFilters =
    !!search ||
    status !== 'all' ||
    type !== 'all' ||
    doctorId !== 'all' ||
    preset !== 'upcoming'

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatus('all')
    setType('all')
    setDoctorId('all')
    setPreset('upcoming')
    setCustomFrom('')
    setCustomTo('')
  }

  const handle = useCallback(async (label: string, run: () => Promise<unknown>) => {
    try {
      await run()
      toast.success(`Appointment ${label}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${label}`)
    }
  }, [])

  const columns = useMemo<ColumnDef<Appointment>[]>(
    () => [
      {
        id: 'token',
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
        header: 'Date & Time',
        cell: ({ row }) => {
          const start = new Date(row.original.startTime)
          const end = new Date(row.original.endTime)
          const dateLabel = start.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          const timeLabel = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          return (
            <div className="font-medium">
              <div>{dateLabel}</div>
              <div className="text-xs text-muted-foreground">{timeLabel}</div>
            </div>
          )
        },
      },
      {
        id: 'patient',
        header: 'Patient',
        cell: ({ row }) => {
          const appt = row.original
          return (
            <div>
              <div className="font-medium truncate max-w-[220px]">
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
        cell: ({ row }) => {
          const doctor = row.original.doctor
          return doctor?.fullName ? (
            <span className="text-sm">{`Dr. ${doctor.fullName}`}</span>
          ) : (
            <span className="text-muted-foreground italic text-sm">Unassigned</span>
          )
        },
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-sm capitalize">
            {row.original.type.replace('_', ' ')}
          </span>
        ),
      },
      {
        id: 'status',
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
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions">
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
                            handle('confirmed', () => confirmMutation.mutateAsync(appt.id))
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
                            handle('checked in', () => checkInMutation.mutateAsync(appt.id))
                          }
                        >
                          <LogIn className="w-3.5 h-3.5 mr-2" />
                          Check in
                        </DropdownMenuItem>
                      )}
                      {appt.status === AppointmentStatus.CHECKED_IN && (
                        <DropdownMenuItem
                          onClick={() =>
                            handle('started', () => startMutation.mutateAsync(appt.id))
                          }
                        >
                          <Stethoscope className="w-3.5 h-3.5 mr-2" />
                          Start consultation
                        </DropdownMenuItem>
                      )}
                      {appt.status === AppointmentStatus.IN_PROGRESS && (
                        <DropdownMenuItem
                          onClick={() =>
                            handle('completed', () => completeMutation.mutateAsync(appt.id))
                          }
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-2" />
                          Complete
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          handle('marked no-show', () => noShowMutation.mutateAsync(appt.id))
                        }
                      >
                        <UserX className="w-3.5 h-3.5 mr-2" />
                        No show
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          handle('cancelled', () => cancelMutation.mutateAsync({ id: appt.id }))
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

  const table = useReactTable({
    data: appointments,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-3">
      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-2 px-3 flex flex-row items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search appointments..."
            className="pl-9 pr-9 h-8 text-xs"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
              type="button"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Date presets */}
        <div className="flex items-center gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPreset(p.value)}
              className={cn(
                'px-2.5 h-8 text-xs font-medium rounded-md border transition-colors',
                preset === p.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent',
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPreset('custom')}
            className={cn(
              'px-2.5 h-8 text-xs font-medium rounded-md border transition-colors',
              preset === 'custom'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-accent',
            )}
          >
            Custom
          </button>
        </div>

        {/* Custom date range (visible only when 'custom') */}
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

        {/* Dropdowns */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-[130px] text-xs" size="sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {APPOINTMENT_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-[120px] text-xs" size="sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {APPOINTMENT_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger className="h-8 w-[150px] text-xs" size="sm">
            <SelectValue placeholder="Doctor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Reset filters"
          >
            <RotateCcw size={13} className="mr-1.5" />
            Reset
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {isFetching ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </span>
          ) : (
            <>
              {total} appointment{total === 1 ? '' : 's'}
              {totalPages > 1 && ` · page ${page} of ${totalPages}`}
            </>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No appointments match these filters.</p>
                    {hasActiveFilters && (
                      <Button variant="link" size="sm" onClick={clearFilters} className="h-6">
                        Clear filters
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCreateModal()}
                      className="mt-1"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New appointment
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    'cursor-pointer hover:bg-accent/40',
                    row.original.status === AppointmentStatus.CANCELLED && 'opacity-50',
                  )}
                  onClick={() => openDetailModal(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────── */}
      <Pagination
        page={page}
        totalPages={totalPages}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l)
          setPage(1)
        }}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </div>
  )
}

