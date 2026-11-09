import { useEffect, useState, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Switch } from '@/components/ui/switch'
import { Loader2, AlertCircle, CheckCircle2, Lightbulb } from 'lucide-react'
import { useAppointmentStore } from '@/store/appointment-store'
import {
  APPOINTMENT_TYPE_OPTIONS,
  DURATION_OPTIONS,
} from '@/features/appointments/types'
import type {
  AppointmentFormData,
  Doctor,
  ValidationResult,
} from '@/features/appointments/types'
import { useCreateAppointment } from '@/features/appointments/hooks/useCreateAppointment'
import { useUpdateAppointment } from '@/features/appointments/hooks/useUpdateAppointment'
import { useValidateAppointment } from '@/features/appointments/hooks/useValidateAppointment'
import { useDoctors } from '@/features/appointments/hooks/useDoctors'
import { useLocationSlotDuration } from '@/features/appointments/hooks/useLocationSlotDuration'
import { fetchAppointmentById } from '@/features/appointments/services/appointments.api'
import { usePatientSearch } from '@/features/patients'
import { toDateTimeLocalValue } from '@/features/appointments/utils/datetime'
import {
  clinicInputToUtc,
  formatInClinic,
  toClinicYmd,
  ymdToDate,
} from '@/lib/datetime'
import { fieldError } from '@/components/forms/fieldError'
import { appointmentModalSchema } from '@/features/appointments/schemas/appointment.schema'
import type { AppointmentModalValues } from '@/features/appointments/schemas/appointment.schema'

interface PatientOption {
  id: string
  fullName: string
  phone: string
  patientNumber?: string
}

export function AppointmentModal() {
  const {
    isCreateModalOpen,
    isEditModalOpen,
    selectedAppointmentId,
    prefillDoctorId,
    prefillTime,
    closeModal,
    setSelectedDate,
  } = useAppointmentStore()

  const isOpen = isCreateModalOpen || isEditModalOpen
  const isEditing = isEditModalOpen && !!selectedAppointmentId

  const { data: doctors = [] } = useDoctors()
  const slotDuration = useLocationSlotDuration()
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment()
  const validateMutation = useValidateAppointment()

  const [patients, setPatients] = useState<PatientOption[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  // Local state mirrors for watched fields (needed for useEffect deps)
  const [watchedDoctorId, setWatchedDoctorId] = useState('')
  const [watchedStartTime, setWatchedStartTime] = useState('')
  const [watchedDuration, setWatchedDuration] = useState(30)

  // Time as loaded for editing — a PUT only carries startTime/duration when
  // they actually changed, so editing notes never reschedules.
  const [original, setOriginal] = useState<{
    startTime: string
    duration: number
  } | null>(null)

  // Duration choices, plus the location default and the loaded value if they
  // aren't one of the presets (e.g. a 20-minute slot or a resized booking).
  const durationOptions = useMemo(() => {
    const values = new Set<number>(DURATION_OPTIONS.map((d) => d.value))
    values.add(slotDuration)
    if (original) values.add(original.duration)
    return [...values]
      .sort((a, b) => a - b)
      .map((value) => ({
        value,
        label:
          DURATION_OPTIONS.find((d) => d.value === value)?.label ??
          `${value} min`,
      }))
  }, [slotDuration, original])

  const defaultValues: AppointmentModalValues = {
    patientId: '',
    doctorId: '',
    startTime: '',
    duration: 30,
    type: 'consultation',
    notes: '',
    isEmergency: false,
  }

  const form = useForm({
    defaultValues,
    validators: {
      onChange: appointmentModalSchema,
      onSubmit: appointmentModalSchema,
    },
    onSubmit: async ({ value }) => {
      const payload = {
        ...(value as AppointmentFormData),
        startTime: clinicInputToUtc(value.startTime),
      }
      try {
        if (isEditing && selectedAppointmentId) {
          // Only fields the update endpoint accepts; time only when changed.
          const changes: Record<string, unknown> = {
            patientId: payload.patientId,
            doctorId: payload.doctorId,
            type: payload.type,
            notes: payload.notes,
          }
          if (!original || payload.startTime !== original.startTime) {
            changes.startTime = payload.startTime
          }
          if (!original || payload.duration !== original.duration) {
            changes.duration = payload.duration
          }
          await updateMutation.mutateAsync({
            id: selectedAppointmentId,
            ...changes,
          })
          toast.success('Appointment updated successfully')
        } else {
          await createMutation.mutateAsync(payload)
          setSelectedDate(ymdToDate(toClinicYmd(payload.startTime)))
          toast.success('Appointment created successfully')
        }
        closeModal()
      } catch (err: any) {
        const msg =
          err?.response?.data?.message || err.message || 'Operation failed'
        toast.error(msg)
      }
    },
  })

  // Load existing appointment for editing
  useEffect(() => {
    if (isEditing && selectedAppointmentId) {
      setLoadingExisting(true)
      fetchAppointmentById(selectedAppointmentId)
        .then((appt) => {
          const startTime = toDateTimeLocalValue(appt.startTime)
          // Loaded values aren't user edits: leave fields untouched.
          const quiet = { dontUpdateMeta: true }
          form.setFieldValue('patientId', appt.patientId, quiet)
          form.setFieldValue('doctorId', appt.doctorId || '', quiet)
          form.setFieldValue('startTime', startTime, quiet)
          form.setFieldValue('duration', appt.durationMinutes, quiet)
          form.setFieldValue('type', appt.type, quiet)
          form.setFieldValue('notes', appt.notes || '', quiet)
          form.setFieldValue('isEmergency', appt.isEmergency, quiet)
          setWatchedDoctorId(appt.doctorId || '')
          setWatchedStartTime(startTime)
          setWatchedDuration(appt.durationMinutes)
          setOriginal({
            startTime: clinicInputToUtc(startTime),
            duration: appt.durationMinutes,
          })
          if (appt.patient) {
            setPatients([
              {
                id: appt.patient.id,
                fullName: appt.patient.fullName,
                phone: appt.patient.phone,
                patientNumber: appt.patient.patientNumber,
              },
            ])
          }
        })
        .catch(() => toast.error('Failed to load appointment'))
        .finally(() => setLoadingExisting(false))
    }
  }, [isEditing, selectedAppointmentId])

  // Prefill from calendar click
  useEffect(() => {
    if (isCreateModalOpen) {
      form.reset()
      setValidation(null)
      setOriginal(null)
      setWatchedDoctorId(prefillDoctorId || '')
      setWatchedStartTime(prefillTime || '')
      setWatchedDuration(slotDuration)
      // Prefills aren't user edits: leave fields untouched.
      const quiet = { dontUpdateMeta: true }
      form.setFieldValue('duration', slotDuration, quiet)
      if (prefillDoctorId)
        form.setFieldValue('doctorId', prefillDoctorId, quiet)
      if (prefillTime) form.setFieldValue('startTime', prefillTime, quiet)
    }
  }, [isCreateModalOpen, prefillDoctorId, prefillTime, slotDuration])

  // Patient type-ahead (debounced, 2+ chars). Picked / preloaded patients
  // stay in `patients` so the chosen one keeps showing.
  const { patients: found, isSearching: loadingPatients } = usePatientSearch(
    patientSearch,
    10,
  )
  const patientOptions: PatientOption[] = found.length
    ? found.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        phone: p.phone,
        patientNumber: p.patientNumber,
      }))
    : patients

  // Real-time validation
  useEffect(() => {
    if (!watchedDoctorId || !watchedStartTime || !watchedDuration) {
      setValidation(null)
      return
    }

    const timer = setTimeout(() => {
      validateMutation.mutate(
        {
          doctorId: watchedDoctorId,
          startTime: clinicInputToUtc(watchedStartTime),
          duration: watchedDuration,
          excludeAppointmentId: selectedAppointmentId || undefined,
        },
        {
          onSuccess: (result) => setValidation(result),
          onError: () =>
            setValidation({ valid: false, reason: 'Validation failed' }),
        },
      )
    }, 500)

    return () => clearTimeout(timer)
  }, [watchedDoctorId, watchedStartTime, watchedDuration])

  const applySuggestion = () => {
    if (validation?.suggestedStartTime) {
      const newTime = toDateTimeLocalValue(validation.suggestedStartTime)
      form.setFieldValue('startTime', newTime)
      setWatchedStartTime(newTime)
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {isEditing ? 'Edit Appointment' : 'New Appointment'}
          </DialogTitle>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
            className="space-y-5 pt-2"
          >
            {/* Patient Search */}
            <form.Field name="patientId">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="patientSearch">Patient *</Label>
                  <Input
                    id="patientSearch"
                    placeholder="Search by name or phone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {loadingPatients && (
                    <p className="text-xs text-muted-foreground">
                      Searching...
                    </p>
                  )}
                  {patientOptions.length > 0 && (
                    <div className="border rounded-md max-h-32 overflow-y-auto">
                      {patientOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            field.handleChange(p.id)
                            setPatientSearch(p.fullName)
                            setPatients([p])
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between ${
                            field.state.value === p.id
                              ? 'bg-primary/5 text-primary font-medium'
                              : ''
                          }`}
                        >
                          <span>{p.fullName}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Doctor Select */}
            <form.Field name="doctorId">
              {(field) => (
                <div className="space-y-2">
                  <Label>Doctor *</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => {
                      field.handleChange(val)
                      setWatchedDoctorId(val)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d: Doctor) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.fullName} — {d.designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Date + Time + Duration */}
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="startTime">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Date & Time *</Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value)
                        setWatchedStartTime(e.target.value)
                      }}
                      onBlur={field.handleBlur}
                    />
                    {fieldError(field) && (
                      <p className="text-xs text-destructive">
                        {fieldError(field)}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="duration">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Duration *</Label>
                    <Select
                      clearable={false}
                      value={String(field.state.value)}
                      onValueChange={(val) => {
                        const num = Number(val)
                        field.handleChange(num)
                        setWatchedDuration(num)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {durationOptions.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldError(field) && (
                      <p className="text-xs text-destructive">
                        {fieldError(field)}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>

            {/* Real-time Validation Feedback */}
            {validation && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                  validation.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {validation.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Time slot is available</span>
                  </>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{validation.reason}</span>
                    </div>
                    {validation.suggestedStartTime && (
                      <button
                        type="button"
                        onClick={applySuggestion}
                        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        Suggested:{' '}
                        {formatInClinic(
                          validation.suggestedStartTime,
                          'hh:mm a',
                        )}
                        <span className="underline ml-1">Apply</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Type */}
            <form.Field name="type">
              {(field) => (
                <div className="space-y-2">
                  <Label>Appointment Type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {/* Flags */}
            <div className="flex items-center gap-6">
              <form.Field name="isEmergency">
                {(field) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={field.state.value as boolean}
                      onCheckedChange={(v) => field.handleChange(v)}
                    />
                    Emergency
                  </label>
                )}
              </form.Field>
            </div>

            {/* Notes */}
            <form.Field name="notes">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    rows={2}
                    placeholder="Optional notes..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
              )}
            </form.Field>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <form.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting] as const}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit ||
                      isSubmitting ||
                      isBusy ||
                      (validation !== null && !validation.valid)
                    }
                  >
                    {(isBusy || isSubmitting) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {isEditing ? 'Update' : 'Create'} Appointment
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
