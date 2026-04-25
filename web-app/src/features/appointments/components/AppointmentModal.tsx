import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react'
import { useAppointmentStore } from '@/store/appointment-store'
import {
  type AppointmentFormData,
  appointmentFormSchema,
  APPOINTMENT_TYPE_OPTIONS,
  DURATION_OPTIONS,
  type Doctor,
  type ValidationResult,
} from '@/features/appointments/types'
import { useCreateAppointment } from '@/features/appointments/hooks/useCreateAppointment'
import { useUpdateAppointment } from '@/features/appointments/hooks/useUpdateAppointment'
import { useValidateAppointment } from '@/features/appointments/hooks/useValidateAppointment'
import { useDoctors } from '@/features/appointments/hooks/useDoctors'
import { fetchAppointmentById } from '@/features/appointments/services/appointments.api'
import api from '@/lib/api'

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
  const createMutation = useCreateAppointment()
  const updateMutation = useUpdateAppointment()
  const validateMutation = useValidateAppointment()

  const [patients, setPatients] = useState<PatientOption[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      startTime: '',
      duration: 30,
      type: 'consultation' as any,
      notes: '',
      isWalkIn: false,
      isEmergency: false,
    },
  })

  const watchedDoctorId = watch('doctorId')
  const watchedStartTime = watch('startTime')
  const watchedDuration = watch('duration')

  // Load existing appointment for editing
  useEffect(() => {
    if (isEditing && selectedAppointmentId) {
      setLoadingExisting(true)
      fetchAppointmentById(selectedAppointmentId)
        .then((appt) => {
          setValue('patientId', appt.patientId)
          setValue('doctorId', appt.doctorId || '')
          setValue(
            'startTime',
            new Date(appt.startTime).toISOString().slice(0, 16),
          )
          setValue('duration', appt.durationMinutes)
          setValue('type', appt.type)
          setValue('notes', appt.notes || '')
          setValue('isWalkIn', appt.isWalkIn)
          setValue('isEmergency', appt.isEmergency)
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
  }, [isEditing, selectedAppointmentId, setValue])

  // Prefill from calendar click
  useEffect(() => {
    if (isCreateModalOpen) {
      reset()
      setValidation(null)
      if (prefillDoctorId) setValue('doctorId', prefillDoctorId)
      if (prefillTime) setValue('startTime', prefillTime)
    }
  }, [isCreateModalOpen, prefillDoctorId, prefillTime, setValue, reset])

  // Search patients
  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) return
    setLoadingPatients(true)
    try {
      const { data } = await api.get('/patients', {
        params: { search: query, limit: 10 },
      })
      const list = data?.data?.data || data?.data || []
      setPatients(
        list.map((p: any) => ({
          id: p.id,
          fullName: p.fullName,
          phone: p.phone,
          patientNumber: p.patientNumber,
        })),
      )
    } catch {
      /* ignore */
    } finally {
      setLoadingPatients(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearch.length >= 2) searchPatients(patientSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch, searchPatients])

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
          startTime: new Date(watchedStartTime).toISOString(),
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
  }, [watchedDoctorId, watchedStartTime, watchedDuration]) // eslint-disable-line

  const onSubmit = async (data: AppointmentFormData) => {
    const payload = {
      ...data,
      startTime: new Date(data.startTime).toISOString(),
    }

    try {
      if (isEditing && selectedAppointmentId) {
        await updateMutation.mutateAsync({
          id: selectedAppointmentId,
          ...payload,
        })
        toast.success('Appointment updated successfully')
      } else {
        await createMutation.mutateAsync(payload)
        setSelectedDate(new Date(payload.startTime))
        toast.success('Appointment created successfully')
      }
      closeModal()
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err.message || 'Operation failed'
      toast.error(msg)
    }
  }

  const applySuggestion = () => {
    if (validation?.suggestedStartTime) {
      const dt = new Date(validation.suggestedStartTime)
      setValue('startTime', dt.toISOString().slice(0, 16))
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
            {/* Patient Search */}
            <div className="space-y-2">
              <Label htmlFor="patientSearch">Patient *</Label>
              <Input
                id="patientSearch"
                placeholder="Search by name or phone..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              {loadingPatients && (
                <p className="text-xs text-muted-foreground">Searching...</p>
              )}
              {patients.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {patients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setValue('patientId', p.id)
                        setPatientSearch(p.fullName)
                        setPatients([p])
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between ${
                        watch('patientId') === p.id
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
              {errors.patientId && (
                <p className="text-xs text-destructive">
                  {errors.patientId.message}
                </p>
              )}
            </div>

            {/* Doctor Select */}
            <div className="space-y-2">
              <Label>Doctor *</Label>
              <Select
                value={watchedDoctorId}
                onValueChange={(val) => setValue('doctorId', val)}
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
              {errors.doctorId && (
                <p className="text-xs text-destructive">
                  {errors.doctorId.message}
                </p>
              )}
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Date & Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  {...register('startTime')}
                />
                {errors.startTime && (
                  <p className="text-xs text-destructive">
                    {errors.startTime.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Duration *</Label>
                <Select
                  value={String(watchedDuration)}
                  onValueChange={(val) => setValue('duration', Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        Suggested:{' '}
                        {new Date(
                          validation.suggestedStartTime,
                        ).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        <span className="underline ml-1">Apply</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Type */}
            <div className="space-y-2">
              <Label>Appointment Type</Label>
              <Select
                value={watch('type')}
                onValueChange={(val) => setValue('type', val as any)}
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
            </div>

            {/* Flags */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={watch('isWalkIn')}
                  onCheckedChange={(v) => setValue('isWalkIn', v)}
                />
                Walk-in
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={watch('isEmergency')}
                  onCheckedChange={(v) => setValue('isEmergency', v)}
                />
                Emergency
              </label>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Optional notes..."
                {...register('notes')}
              />
            </div>

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
              <Button
                type="submit"
                disabled={isBusy || (validation !== null && !validation.valid)}
              >
                {isBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Update' : 'Create'} Appointment
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
