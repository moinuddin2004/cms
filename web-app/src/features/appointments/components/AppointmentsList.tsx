import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Search,
  Filter,
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

const PAGE_SIZE = 25

export function AppointmentsList() {
  const { openCreateModal, openDetailModal } = useAppointmentStore()
  const { data: doctors = [] } = useDoctors()

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
    limit: PAGE_SIZE,
  })

  const appointments = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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

  return (
    <div className="space-y-3">
      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl p-3 space-y-3">
        {/* Row 1: search + date presets */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by patient name, phone, patient #, or token…"
              className="pl-9 pr-9 h-9"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                  preset === p.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-accent',
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                preset === 'custom'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent',
              )}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom date range (visible only when 'custom') */}
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">From</span>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-[160px]"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-[160px]"
            />
          </div>
        )}

        {/* Row 2: dropdown filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
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
            <SelectTrigger className="h-8 w-[140px] text-xs">
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
            <SelectTrigger className="h-8 w-[180px] text-xs">
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

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear
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
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">Token</TableHead>
              <TableHead className="w-[170px]">Date & Time</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
                </TableCell>
              </TableRow>
            ) : appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CalendarDays className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No appointments match these filters.</p>
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
                      className="mt-1"
                    >
                      + New appointment
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  onOpen={() => openDetailModal(appt.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────

function AppointmentRow({
  appt,
  onOpen,
}: {
  appt: Appointment
  onOpen: () => void
}) {
  const { openEditModal } = useAppointmentStore()
  const cancelMutation = useCancelAppointment()
  const noShowMutation = useNoShow()
  const checkInMutation = useCheckIn()
  const startMutation = useStartAppointment()
  const completeMutation = useCompleteAppointment()
  const confirmMutation = useConfirmAppointment()

  const start = new Date(appt.startTime)
  const end = new Date(appt.endTime)
  const dateLabel = start.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeLabel = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  const isCancelled = appt.status === AppointmentStatus.CANCELLED
  const isCompleted = appt.status === AppointmentStatus.COMPLETED
  const isNoShow = appt.status === AppointmentStatus.NO_SHOW
  const isTerminal = isCancelled || isCompleted || isNoShow

  const handle = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run()
      toast.success(`Appointment ${label}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${label}`)
    }
  }

  return (
    <TableRow
      className={cn(
        'cursor-pointer hover:bg-accent/40',
        isCancelled && 'opacity-50',
      )}
      onClick={onOpen}
    >
      <TableCell>
        {appt.tokenNumber != null ? (
          <span className="inline-flex h-7 min-w-[44px] items-center justify-center rounded-md bg-primary/10 px-2 text-sm font-bold tabular-nums text-primary">
            #{appt.tokenNumber}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="font-medium">
        <div>{dateLabel}</div>
        <div className="text-xs text-muted-foreground">{timeLabel}</div>
      </TableCell>
      <TableCell>
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
      </TableCell>
      <TableCell className="text-sm">
        {appt.doctor?.fullName ? `Dr. ${appt.doctor.fullName}` : (
          <span className="text-muted-foreground italic">Unassigned</span>
        )}
      </TableCell>
      <TableCell className="text-sm capitalize">
        {appt.type.replace('_', ' ')}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize',
            STATUS_BG_COLORS[appt.status],
          )}
        >
          {appt.status.replace('_', ' ')}
        </span>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
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
      </TableCell>
    </TableRow>
  )
}
