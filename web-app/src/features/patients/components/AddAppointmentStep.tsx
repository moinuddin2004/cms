import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Switch } from '@/components/ui/switch'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Check,
  ChevronLeft,
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
import { cn } from '@/lib/utils'
import { FORM_STEPS } from '../types'
import { toDateTimeLocalValue } from '@/features/appointments/utils/datetime'

// All steps including the appointment booking step
const ALL_STEPS = [...FORM_STEPS.map((s) => s.title), 'Book Appointment']

interface AddAppointmentStepProps {
  patientId: string
  patientName: string
  onSkip: () => void
  onDone: () => void
  onBack: () => void
}

export function AddAppointmentStep({
  patientId,
  patientName,
  onSkip,
  onDone,
  onBack,
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
        notes: '',
        isEmergency: value.isEmergency,
      }
      try {
        await createMutation.mutateAsync(payload)
        toast.success('Appointment booked successfully')
        onDone()
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err.message ||
          'Failed to book appointment'
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
          onError: () =>
            setValidation({ valid: false, reason: 'Validation failed' }),
        },
      )
    }, 500)
    return () => clearTimeout(timer)
  }, [watchedDoctorId, watchedStartTime, watchedDuration]) // eslint-disable-line

  const applySuggestion = () => {
    if (validation?.suggestedStartTime) {
      const newTime = toDateTimeLocalValue(validation.suggestedStartTime)
      form.setFieldValue('startTime', newTime)
      setWatchedStartTime(newTime)
    }
  }

  const activeStep = ALL_STEPS.length - 1 // last step

  return (
    <div className="flex flex-col gap-5">
      {/* ── Step Indicator (same style as PatientForm) ── */}
      <div className="flex items-center w-full">
        {ALL_STEPS.map((title, i) => (
          <div key={title} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  i < activeStep
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : i === activeStep
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-background border-border text-muted-foreground',
                )}
              >
                {i < activeStep ? <Check size={11} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm font-medium hidden sm:inline',
                  i === activeStep
                    ? 'text-brand-700'
                    : i < activeStep
                      ? 'text-brand-500'
                      : 'text-slate-400',
                )}
              >
                {title}
              </span>
            </div>
            {i < ALL_STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-3 transition-colors duration-300',
                  i < activeStep ? 'bg-brand-400' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Form ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Appointment Details
            </p>

            {/* Row 1: Patient (read-only) + Doctor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Patient</Label>
                <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                  {patientName}
                </div>
              </div>

              <form.Field name="doctorId">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label>
                      Doctor <span className="text-destructive">*</span>
                    </Label>
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
            </div>

            {/* Row 2: Date+Time + Duration */}
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="startTime">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="appt-startTime">
                      Date & Time <span className="text-destructive">*</span>
                    </Label>
                    <DateTimePicker
                      id="appt-startTime"
                      value={field.state.value}
                      onChange={(val) => {
                        field.handleChange(val)
                        setWatchedStartTime(val)
                      }}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="duration">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label>
                      Duration <span className="text-destructive">*</span>
                    </Label>
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

            {/* Validation feedback */}
            {validation && (
              <div
                className={cn(
                  'flex items-start gap-2 px-3 py-2 rounded-lg border text-sm',
                  validation.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-700',
                )}
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
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        Apply suggested:{' '}
                        {new Date(
                          validation.suggestedStartTime,
                        ).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Type + Walk-in + Emergency */}
            <div className="grid grid-cols-3 gap-4 items-end">
              <form.Field name="type">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) =>
                        field.handleChange(val as AppointmentType)
                      }
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

              <form.Field name="isEmergency">
                {(field) => (
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer h-9">
                    <Switch
                      checked={field.state.value as boolean}
                      onCheckedChange={(v) => field.handleChange(v)}
                    />
                    Emergency
                  </label>
                )}
              </form.Field>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between mt-5">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={createMutation.isPending}
            className="gap-1.5"
          >
            <ChevronLeft size={15} /> Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={createMutation.isPending}
              className="gap-1.5 text-muted-foreground"
            >
              <SkipForward size={15} />
              Skip
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                (validation !== null && !validation.valid)
              }
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CalendarPlus size={15} />
              )}
              Book Appointment
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
