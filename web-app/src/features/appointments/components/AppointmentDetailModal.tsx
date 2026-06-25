import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  User as UserIcon,
  Stethoscope,
  Clock,
  CalendarDays,
  Phone,
  FileText,
  ExternalLink,
  Printer,
  Pencil,
  LogIn,
  CheckCircle,
  ThumbsUp,
  UserX,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppointmentStore } from '@/store/appointment-store'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchAppointmentById } from '../services/appointments.api'
import {
  AppointmentStatus,
  STATUS_BG_COLORS,
  formatToken,
  type Appointment,
} from '../types'
import {
  useCancelAppointment,
  useCheckIn,
  useStartAppointment,
  useCompleteAppointment,
  useConfirmAppointment,
  useNoShow,
} from '../hooks/useAppointmentActions'
import { printAppointmentReceipt } from '../utils/print'

export function AppointmentDetailModal() {
  const {
    isDetailModalOpen,
    selectedAppointmentId,
    closeModal,
    openEditModal,
  } = useAppointmentStore()
  const navigate = useNavigate()
  const authStore = useAuthStore()

  const { data: appt, isLoading } = useQuery({
    queryKey: ['appointment-detail', selectedAppointmentId],
    queryFn: () => fetchAppointmentById(selectedAppointmentId!),
    enabled: isDetailModalOpen && !!selectedAppointmentId,
  })

  // Resolve clinic + location names from the auth store for the printed receipt.
  const { clinicName, locationName } = useMemo(() => {
    const org = authStore.accessibleOrganizations.find(
      (o) => o.id === authStore.activeOrganizationId,
    )
    const loc = org?.locations.find(
      (l) => l.id === authStore.activeLocationId,
    )
    return { clinicName: org?.name, locationName: loc?.name }
  }, [
    authStore.accessibleOrganizations,
    authStore.activeOrganizationId,
    authStore.activeLocationId,
  ])

  return (
    <Dialog
      open={isDetailModalOpen}
      onOpenChange={(open) => !open && closeModal()}
    >
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-0">
        {isLoading || !appt ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DetailBody
            appt={appt}
            clinicName={clinicName}
            locationName={locationName}
            onClose={closeModal}
            onEdit={() => openEditModal(appt.id)}
            onViewPatient={() => {
              closeModal()
              navigate({
                to: '/patients/$patientId',
                params: { patientId: appt.patientId },
              })
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({
  appt,
  clinicName,
  locationName,
  onClose,
  onEdit,
  onViewPatient,
}: {
  appt: Appointment
  clinicName?: string
  locationName?: string
  onClose: () => void
  onEdit: () => void
  onViewPatient: () => void
}) {
  const cancelMutation = useCancelAppointment()
  const noShowMutation = useNoShow()
  const checkInMutation = useCheckIn()
  const startMutation = useStartAppointment()
  const completeMutation = useCompleteAppointment()
  const confirmMutation = useConfirmAppointment()

  const start = new Date(appt.startTime)
  const end = new Date(appt.endTime)
  const dateLabel = start.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeLabel = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  const tokenDisplay = formatToken(appt)
  const hasToken = appt.tokenNumber != null

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
    <>
      {/* ── Header with token ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b px-6 pt-6 pb-5">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center justify-between gap-4">
            <span className="text-base font-semibold">
              Appointment Details
            </span>
            <span
              className={cn(
                'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize',
                STATUS_BG_COLORS[appt.status],
              )}
            >
              {appt.status.replace('_', ' ')}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detailed appointment information with quick actions.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Token
            </p>
            {hasToken ? (
              <p className="text-4xl font-bold tabular-nums leading-none mt-1">
                {tokenDisplay}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic leading-none mt-2">
                Assigned at check-in
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {appt.isEmergency && (
              <Badge variant="destructive">Emergency</Badge>
            )}
            {appt.isWalkIn && (
              <Badge variant="secondary">Walk-in</Badge>
            )}
            <Badge variant="outline" className="capitalize">
              {appt.type.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="px-6 py-5 space-y-5">
        {/* Patient */}
        <Section icon={<UserIcon size={14} />} label="Patient">
          <button
            onClick={onViewPatient}
            className="group text-left w-full hover:bg-accent rounded-lg p-2.5 -m-2.5 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {appt.patient?.fullName ?? 'Unknown patient'}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {appt.patient?.patientNumber && (
                    <span className="font-mono">
                      {appt.patient.patientNumber}
                    </span>
                  )}
                  {appt.patient?.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {appt.patient.phone}
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink
                size={14}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1"
              />
            </div>
            <p className="text-[10px] text-primary mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              Open patient record →
            </p>
          </button>
        </Section>

        <Separator />

        {/* Doctor + when */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Section icon={<Stethoscope size={14} />} label="Doctor">
            <p className="text-sm font-medium">
              {appt.doctor?.fullName ? (
                <>Dr. {appt.doctor.fullName}</>
              ) : (
                <span className="italic text-muted-foreground">
                  Unassigned
                </span>
              )}
            </p>
            {appt.doctor?.designation && (
              <p className="text-xs text-muted-foreground">
                {appt.doctor.designation}
              </p>
            )}
          </Section>

          <Section icon={<CalendarDays size={14} />} label="When">
            <p className="text-sm font-medium">{dateLabel}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock size={11} /> {timeLabel} · {appt.durationMinutes} min
            </p>
          </Section>
        </div>

        {/* Notes */}
        {appt.notes && (
          <>
            <Separator />
            <Section icon={<FileText size={14} />} label="Notes">
              <p className="text-sm whitespace-pre-wrap text-foreground/90">
                {appt.notes}
              </p>
            </Section>
          </>
        )}

        {/* Cancel reason */}
        {appt.cancelReason && (
          <>
            <Separator />
            <Section icon={<XCircle size={14} />} label="Cancellation reason">
              <p className="text-sm text-destructive">{appt.cancelReason}</p>
            </Section>
          </>
        )}

        {/* Quick status actions */}
        {!isTerminal && (
          <>
            <Separator />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Quick actions
              </p>
              <div className="flex flex-wrap gap-2">
                {(appt.status === AppointmentStatus.SCHEDULED ||
                  appt.status === AppointmentStatus.RESCHEDULED) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handle('confirmed', () =>
                        confirmMutation.mutateAsync(appt.id),
                      )
                    }
                  >
                    <ThumbsUp size={14} className="mr-1.5" /> Confirm
                  </Button>
                )}
                {(appt.status === AppointmentStatus.SCHEDULED ||
                  appt.status === AppointmentStatus.CONFIRMED ||
                  appt.status === AppointmentStatus.RESCHEDULED) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handle('checked in', () =>
                        checkInMutation.mutateAsync(appt.id),
                      )
                    }
                  >
                    <LogIn size={14} className="mr-1.5" /> Check in
                  </Button>
                )}
                {appt.status === AppointmentStatus.CHECKED_IN && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handle('started', () =>
                        startMutation.mutateAsync(appt.id),
                      )
                    }
                  >
                    <Stethoscope size={14} className="mr-1.5" /> Start
                  </Button>
                )}
                {appt.status === AppointmentStatus.IN_PROGRESS && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handle('completed', () =>
                        completeMutation.mutateAsync(appt.id),
                      )
                    }
                  >
                    <CheckCircle size={14} className="mr-1.5" /> Complete
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handle('marked no-show', () =>
                      noShowMutation.mutateAsync(appt.id),
                    )
                  }
                >
                  <UserX size={14} className="mr-1.5" /> No show
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    handle('cancelled', () =>
                      cancelMutation.mutateAsync({ id: appt.id }),
                    )
                  }
                >
                  <XCircle size={14} className="mr-1.5" /> Cancel
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-6 py-3 border-t bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            printAppointmentReceipt(appt, { clinicName, locationName })
          }
        >
          <Printer size={14} className="mr-1.5" /> Print receipt
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={onEdit}>
            <Pencil size={14} className="mr-1.5" /> Edit
          </Button>
        </div>
      </div>
    </>
  )
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold inline-flex items-center gap-1.5 mb-1.5">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}
