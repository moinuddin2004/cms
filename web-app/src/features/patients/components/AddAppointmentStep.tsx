import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
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
  UserCheck,
  CalendarPlus,
  SkipForward,
} from 'lucide-react'
import {
  AppointmentType,
  APPOINTMENT_TYPE_OPTIONS,
  DURATION_OPTIONS,
  type Doctor,
  type ValidationResult,
  type AppointmentFormData,
} from '@/features/appointments/types'
import { useCreateAppointment } from '@/features/appointments/hooks/useCreateAppointment'
import { useValidateAppointment } from '@/features/appointments/hooks/useValidateAppointment'
import { useDoctors } from '@/features/appointments/hooks/useDoctors'

interface AddAppointmentStepProps {
  patientId: string
  patientName: string
  onSkip: () => void
  onDone: () => void
}

export function AddAppointmentStep({
  patientId,
  patientName,
  onSkip,
  onDone,
}: AddAppointmentStepProps) {
  const { data: doctors = [] } = useDoctors()
  const createMutation = useCreateAppointment()
  const validateMutation = useValidateAppointment()

  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [watchedDoctorId, setWatchedDoctorId] = useState('')
  const [watchedStartTime, setWatchedStartTime] = useState('')
  const [watchedDuration, setWatchedDuration] = useState(30)

  const form = useForm({
    defaultValues: {
      doctorId: '',
      startTime: '',
      duration: 30,
      type: AppointmentType.CONSULTATION,
      notes: '',
      isWalkIn: false,
      isEmergency: false,
    },
    onSubmit: async ({ value }) => {
      if (!value.doctorId || !value.startTime) {
        toast.error('Please select a doctor and appointment time')
        return
      }
      const payload: AppointmentFormData = {
        patientId,
        doctorId: value.doctorId,
        startTime: new Date(value.startTime).toISOString(),
        duration: value.duration,
        type: value.type,
        notes: value.notes,
        isWalkIn: value.isWalkIn,
        isEmergency: value.isEmergency,
      }
      try {
        await createMutation.mutateAsync(payload)
        toast.success('Appointment booked successfully')
        onDone()
      } catch (err: any) {
        const msg = err?.response?.data?.message || err.message || 'Failed to book appointment'
        toast.error(msg)
      }
    },
  })

  // Real-time slot validation
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
        },
        {
          onSuccess: (result) => setValidation(result),
          onError: () => setValidation({ valid: false, reason: 'Validation failed' }),
        },
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [watchedDoctorId, watchedStartTime, watchedDuration]) // eslint-disable-line

  const applySuggestion = () => {
    if (validation?.suggestedStartTime) {
      const newTime = new Date(validation.suggestedStartTime).toISOString().slice(0, 16)
      form.setFieldValue('startTime', newTime)
      setWatchedStartTime(newTime)
    }
  }

  return (
    <div className="space-y-5">
      {/* Success banner */}
      <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
        <UserCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-800">
            {patientName} added successfully!
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Would you like to book their first appointment right now?
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="space-y-4"
      >
        {/* Patient — read-only */}
        <div className="space-y-1.5">
          <Label>Patient</Label>
          <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
            {patientName}
          </div>
        </div>

        {/* Doctor */}
        <form.Field name="doctorId">
          {(field) => (
            <div className="space-y-1.5">
              <Label>Doctor <span className="text-destructive">*</span></Label>
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
            </div>
          )}
        </form.Field>

        {/* Date + Time + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="startTime">
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="appt-startTime">
                  Date & Time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="appt-startTime"
                  type="datetime-local"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    setWatchedStartTime(e.target.value)
                  }}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="duration">
            {(field) => (
              <div className="space-y-1.5">
                <Label>Duration <span className="text-destructive">*</span></Label>
                <Select
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
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        </div>

        {/* Real-time validation feedback */}
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
                    {new Date(validation.suggestedStartTime).toLocaleTimeString([], {
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

        {/* Appointment Type */}
        <form.Field name="type">
          {(field) => (
            <div className="space-y-1.5">
              <Label>Appointment Type</Label>
              <Select
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as AppointmentType)}
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
          )}
        </form.Field>

        {/* Flags */}
        <div className="flex items-center gap-6">
          <form.Field name="isWalkIn">
            {(field) => (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={field.state.value as boolean}
                  onCheckedChange={(v) => field.handleChange(v)}
                />
                Walk-in
              </label>
            )}
          </form.Field>
          <form.Field name="isEmergency">
            {(field) => (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
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
            <div className="space-y-1.5">
              <Label htmlFor="appt-notes">Notes</Label>
              <Textarea
                id="appt-notes"
                rows={2}
                placeholder="Reason for visit, special instructions..."
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={createMutation.isPending}
            className="text-muted-foreground"
          >
            <SkipForward className="w-4 h-4 mr-1.5" />
            Skip for now
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || (validation !== null && !validation.valid)}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CalendarPlus className="w-4 h-4 mr-2" />
            )}
            Book Appointment
          </Button>
        </div>
      </form>
    </div>
  )
}
