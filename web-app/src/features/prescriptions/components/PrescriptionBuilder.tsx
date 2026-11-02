import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-form'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  Printer,
  Save,
  CheckCircle2,
  History,
  Search,
  ExternalLink,
  LayoutTemplate,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { TooltipButton } from '@/components/shared/TooltipButton'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import {
  useDefaultPrescriptionTemplate,
  usePrescriptionTemplates,
} from '../hooks/usePrescriptionTemplates'
import { usePrescriptionPresets } from '../hooks/usePrescriptionPresets'
import { useDoctors } from '@/features/appointments/hooks/useDoctors'
import {
  useFinalizePrescription,
  usePrescription,
} from '../hooks/usePrescriptions'
import { useMySignature, useSaveMySignature } from '../hooks/useDoctorSignature'
import {
  emptyMedicineLine,
  toMedicineLine,
  usePrescriptionForm,
} from '../hooks/usePrescriptionForm'
import type { PrescriptionPatient } from '../schemas/prescription.schema'
import {
  MealRelation,
  PrescriptionStatus,
  DURATION_PRESETS,
  presetCategoryLabel,
  FREQUENCY_PRESETS,
  MEAL_RELATION_OPTIONS,
} from '../types'
import {
  MedicineAutocomplete,
  medicineFromDirectory,
} from './MedicineAutocomplete'
import { PrescriptionPreview } from './PrescriptionPreview'
import type { PreviewData } from './PrescriptionPreview'
import { SignaturePad } from '@/components/shared/SignaturePad'
import type { SignaturePadHandle } from '@/components/shared/SignaturePad'
import { fetchPrescriptionPdf } from '../services/prescriptions.api'

interface BuilderProps {
  /** Existing prescription to edit. When omitted, builder is in create mode. */
  prescriptionId?: string
  /** Pre-select patient (e.g. when launching from a patient page). */
  initialPatientId?: string
  /** Link to an appointment when creating from /appointments. */
  initialAppointmentId?: string
}

const toPatient = (p: any): PrescriptionPatient => ({
  id: p.id,
  fullName: p.fullName,
  phone: p.phone,
  patientNumber: p.patientNumber,
  dob: p.dob ?? null,
  gender: p.gender ?? null,
})

/** The list-level medicines error ("Add at least one medicine"). */
function listError(meds: {
  state: { meta: { errors: unknown[] } }
  form: { state: { isTouched: boolean; submissionAttempts: number } }
}) {
  return fieldError({
    state: {
      meta: {
        errors: meds.state.meta.errors,
        isTouched: meds.form.state.isTouched,
      },
    },
    form: meds.form,
  })
}

export function PrescriptionBuilder({
  prescriptionId,
  initialPatientId,
  initialAppointmentId,
}: BuilderProps) {
  const navigate = useNavigate()
  const isEditing = !!prescriptionId

  // ── Load existing prescription (edit mode) ──────────────────────────
  const { data: existing, isLoading: loadingExisting } =
    usePrescription(prescriptionId)

  // ── Form ────────────────────────────────────────────────────────────
  const [signatureOpen, setSignatureOpen] = useState(false)
  const { form, createMutation, pending } = usePrescriptionForm({
    existing,
    initialAppointmentId,
    onReadyToSign: () => setSignatureOpen(true),
  })
  const values = useStore(form.store, (s) => s.values)
  const patient = values.patient

  // ── Template data ──────────────────────────────────────────────────
  const { activeLocationId } = useAuthStore()
  const { data: templates = [] } = usePrescriptionTemplates(
    activeLocationId ?? undefined,
  )
  const { data: defaultTemplate } = useDefaultPrescriptionTemplate(
    activeLocationId ?? undefined,
  )
  const { data: presets = [] } = usePrescriptionPresets()
  const { data: doctors = [] } = useDoctors()
  const { data: mySignature } = useMySignature()
  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === values.doctorId) ?? null,
    [doctors, values.doctorId],
  )

  const activeTemplate = useMemo(
    () =>
      templates.find((t) => t.id === values.templateId) ??
      defaultTemplate ??
      null,
    [templates, values.templateId, defaultTemplate],
  )

  // ── Patient picker (search box is not form data) ───────────────────
  const [patientQuery, setPatientQuery] = useState('')
  const [patientOpen, setPatientOpen] = useState(false)
  const [patientResults, setPatientResults] = useState<PrescriptionPatient[]>(
    [],
  )
  const [patientLoading, setPatientLoading] = useState(false)

  useEffect(() => {
    if (patientQuery.trim().length < 2) {
      setPatientResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        setPatientLoading(true)
        const { data } = await api.get('/patients', {
          params: { search: patientQuery, limit: 10 },
        })
        const list = data?.data?.data || data?.data || []
        setPatientResults(list.map(toPatient))
      } catch {
        // ignore
      } finally {
        setPatientLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [patientQuery])

  // Pre-select an initial patient when opened from a patient page.
  useEffect(() => {
    if (!initialPatientId || form.getFieldValue('patient')) return
    api
      .get(`/patients/${initialPatientId}`)
      .then(({ data }) => {
        const p = data?.data
        if (p && !form.getFieldValue('patient'))
          form.setFieldValue('patient', toPatient(p))
      })
      .catch(() => {})
  }, [initialPatientId, form])

  // ── Finalize flow ───────────────────────────────────────────────────
  const finalizeMutation = useFinalizePrescription()
  const sigPadRef = useRef<SignaturePadHandle>(null)
  const saveSignatureMutation = useSaveMySignature()

  const confirmFinalize = async () => {
    if (!existing && !createMutation.data) return
    const pid = (existing?.id ?? createMutation.data?.id) as string

    let signatureImageUrl: string | undefined =
      mySignature?.signatureImageUrl ?? undefined

    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataUrl = sigPadRef.current.toDataURL()
      if (dataUrl) {
        signatureImageUrl = dataUrl
        // Persist for reuse next time
        try {
          await saveSignatureMutation.mutateAsync({
            signatureImageUrl: dataUrl,
          })
        } catch {
          // non-blocking — finalize anyway
        }
      }
    }

    if (!signatureImageUrl) {
      toast.error('Please draw your signature or use a saved one')
      return
    }

    await finalizeMutation.mutateAsync({
      id: pid,
      data: { signatureImageUrl },
    })
    setSignatureOpen(false)
    navigate({
      to: '/prescriptions/$prescriptionId',
      params: { prescriptionId: pid },
      replace: true,
    })
  }

  // ── Preset apply ───────────────────────────────────────────────────
  const applyPreset = (templateIdToApply: string) => {
    const tpl = presets.find((p) => p.id === templateIdToApply)
    if (!tpl) return
    form.setFieldValue('prescriptionPresetId', tpl.id)
    form.setFieldValue(
      'medicines',
      tpl.medicines.length
        ? tpl.medicines.map((m) =>
            toMedicineLine({
              ...m,
              medicineDirectoryId: m.medicineDirectoryId ?? undefined,
            }),
          )
        : [emptyMedicineLine()],
    )
    const v = form.state.values
    if (!v.furtherPlan && tpl.furtherPlan)
      form.setFieldValue('furtherPlan', tpl.furtherPlan)
    if (!v.instructionsEnglish && tpl.instructionsEnglish)
      form.setFieldValue('instructionsEnglish', tpl.instructionsEnglish)
    if (!v.instructionsUrdu && tpl.instructionsUrdu)
      form.setFieldValue('instructionsUrdu', tpl.instructionsUrdu)
    toast.success(`Applied preset: ${tpl.name}`)
  }

  // ── Print existing PDF ──────────────────────────────────────────────
  const handlePrint = async () => {
    if (!existing) {
      toast.error('Save the prescription first')
      return
    }
    try {
      const blob = await fetchPrescriptionPdf(existing.id)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) win.focus()
    } catch {
      toast.error('Failed to load PDF')
    }
  }

  // ── Preview data ────────────────────────────────────────────────────
  const previewData: PreviewData = useMemo(
    () => ({
      prescriptionNumber: existing?.prescriptionNumber,
      createdAt: existing?.createdAt,
      patient: patient
        ? {
            id: patient.id,
            fullName: patient.fullName,
            patientNumber: patient.patientNumber ?? '',
            phone: patient.phone,
            dob: patient.dob ?? null,
            gender: patient.gender ?? null,
          }
        : undefined,
      doctor:
        existing?.doctor ??
        (selectedDoctor
          ? {
              id: selectedDoctor.id,
              fullName: selectedDoctor.fullName,
              designation: selectedDoctor.designation,
            }
          : null),
      diagnosis: values.diagnosis,
      chiefComplaint: values.chiefComplaint,
      furtherPlan: values.furtherPlan,
      instructionsEnglish: values.instructionsEnglish,
      instructionsUrdu: values.instructionsUrdu,
      vitals: values.vitals,
      medicines: values.medicines,
    }),
    [existing, patient, selectedDoctor, values],
  )

  if (isEditing && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const finalized = existing?.status === PrescriptionStatus.FINALIZED

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {/* ════ LEFT — EDITOR ══════════════════════════════════════════ */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Presets <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Apply prescription preset</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {presets.length === 0 && (
                <div className="px-2 py-3 text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    No prescription presets saved yet.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                  >
                    <Link to="/settings/prescription-presets">
                      <Plus className="h-3 w-3 mr-1" /> Create one
                    </Link>
                  </Button>
                </div>
              )}
              {presets.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {presetCategoryLabel(p.category)} · {p.medicines.length}{' '}
                      medicines
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
              {presets.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/settings/prescription-presets"
                      className="text-xs text-muted-foreground"
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Manage prescription presets
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {templates.length === 0 ? (
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to="/settings/prescription-templates">
                <LayoutTemplate className="h-3 w-3 mr-1.5" />
                Set up layout
              </Link>
            </Button>
          ) : (
            <form.Field name="templateId">
              {(field) => (
                <Select
                  clearable={false}
                  value={field.state.value || defaultTemplate?.id || ''}
                  onValueChange={(v) => field.handleChange(v)}
                >
                  <SelectTrigger className="h-9 w-[200px] text-xs">
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.isDefault && '(default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </form.Field>
          )}

          {existing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                (navigate as any)({
                  to: '/prescriptions/$prescriptionId',
                  params: { prescriptionId: existing.id },
                  search: { tab: 'history' },
                })
              }
            >
              <History className="h-3.5 w-3.5 mr-1.5" /> History
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {finalized && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Finalized
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              disabled={!existing}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
            </Button>
          </div>
        </div>

        {/* Patient */}
        <form.Field name="patient">
          {(field) => (
            <div className="bg-card border rounded-lg p-3 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Patient
              </Label>
              <FieldWrapper error={fieldError(field)}>
                {field.state.value ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {field.state.value.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {field.state.value.patientNumber ?? ''} ·{' '}
                        {field.state.value.phone}
                      </p>
                    </div>
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => field.handleChange(null)}
                      >
                        Change
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={patientQuery}
                      onChange={(e) => {
                        setPatientQuery(e.target.value)
                        setPatientOpen(true)
                      }}
                      onFocus={() => setPatientOpen(true)}
                      onBlur={field.handleBlur}
                      aria-invalid={!!fieldError(field)}
                      placeholder="Search patient by name or phone…"
                      className="pl-9 h-9"
                    />
                    {patientOpen && patientQuery.trim().length >= 2 && (
                      <div className="absolute z-20 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
                        {patientLoading && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Searching…
                          </div>
                        )}
                        {!patientLoading && patientResults.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            No patients found
                          </div>
                        )}
                        {patientResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              field.handleChange(p)
                              setPatientOpen(false)
                              setPatientQuery('')
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          >
                            <p className="font-medium">{p.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.patientNumber} · {p.phone}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </FieldWrapper>
            </div>
          )}
        </form.Field>

        {/* Doctor */}
        <form.Field name="doctorId">
          {(field) => (
            <div className="bg-card border rounded-lg p-3 space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Prescribing Doctor
              </Label>
              <FieldWrapper error={fieldError(field)}>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => {
                    field.handleChange(v || '')
                    field.handleBlur()
                  }}
                >
                  <SelectTrigger
                    className="h-9"
                    aria-invalid={!!fieldError(field)}
                  >
                    <SelectValue placeholder="Select a doctor…" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        No doctors found
                      </SelectItem>
                    ) : (
                      doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          Dr. {d.fullName}
                          {d.designation ? ` · ${d.designation}` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FieldWrapper>
            </div>
          )}
        </form.Field>

        {/* Complaint / diagnosis */}
        <div className="bg-card border rounded-lg p-3 space-y-3">
          <form.Field name="chiefComplaint">
            {(field) => (
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Chief Complaint
                </Label>
                <FieldWrapper error={fieldError(field)} className="mt-1">
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="h-9"
                    placeholder="What brought the patient in today?"
                  />
                </FieldWrapper>
              </div>
            )}
          </form.Field>
          <form.Field name="diagnosis">
            {(field) => (
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Diagnosis
                </Label>
                <FieldWrapper error={fieldError(field)} className="mt-1">
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="h-9"
                    placeholder="e.g. Dental caries, Gingivitis"
                  />
                </FieldWrapper>
              </div>
            )}
          </form.Field>
        </div>

        {/* Vitals */}
        <details className="bg-card border rounded-lg p-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex items-center justify-between cursor-pointer">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Vitals (optional)
            </Label>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </summary>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {(
              [
                ['bp', 'BP', '120/80'],
                ['pulse', 'Pulse', '72'],
                ['temperature', 'Temp', '37°C'],
                ['spo2', 'SpO₂', '98%'],
                ['weight', 'Weight', 'kg'],
                ['height', 'Height', 'cm'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <form.Field key={key} name={`vitals.${key}`}>
                {(field) => (
                  <VitalInput
                    label={label}
                    value={field.state.value}
                    onChange={(v) => field.handleChange(v)}
                    onBlur={field.handleBlur}
                    error={fieldError(field)}
                    placeholder={placeholder}
                  />
                )}
              </form.Field>
            ))}
          </div>
        </details>

        {/* Medicines */}
        <form.Field name="medicines" mode="array">
          {(meds) => (
            <div className="bg-card border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Medicines
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => meds.pushValue(emptyMedicineLine())}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add medicine
                </Button>
              </div>
              <div className="space-y-3">
                {meds.state.value.map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border bg-muted/20 p-2.5 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono w-5 text-center pt-2.5">
                        {idx + 1}.
                      </span>
                      <form.Field name={`medicines[${idx}].medicineName`}>
                        {(f) => (
                          <FieldWrapper
                            error={fieldError(f)}
                            className="flex-1"
                          >
                            <MedicineAutocomplete
                              value={f.state.value}
                              onChange={(v) => f.handleChange(v)}
                              onPick={(picked) =>
                                form.setFieldValue(`medicines[${idx}]`, {
                                  ...form.getFieldValue(`medicines[${idx}]`),
                                  ...toMedicineLine(
                                    medicineFromDirectory(picked),
                                  ),
                                })
                              }
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                      <TooltipButton
                        tooltip="Remove medicine"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (meds.state.value.length > 1) meds.removeValue(idx)
                          else
                            form.setFieldValue('medicines', [
                              emptyMedicineLine(),
                            ])
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </TooltipButton>
                    </div>
                    <div className="grid grid-cols-12 gap-2 pl-7">
                      <form.Field name={`medicines[${idx}].dosage`}>
                        {(f) => (
                          <FieldWrapper
                            error={fieldError(f)}
                            className="col-span-2"
                          >
                            <Input
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                              onBlur={f.handleBlur}
                              className="h-8 text-xs"
                              placeholder="Dose"
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                      <form.Field name={`medicines[${idx}].frequency`}>
                        {(f) => (
                          <FieldWrapper
                            error={fieldError(f)}
                            className="col-span-4"
                          >
                            <FreeSelect
                              value={f.state.value}
                              onChange={(v) => f.handleChange(v)}
                              onBlur={f.handleBlur}
                              options={FREQUENCY_PRESETS}
                              placeholder="Frequency"
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                      <form.Field name={`medicines[${idx}].mealRelation`}>
                        {(f) => (
                          <div className="col-span-3">
                            <Select
                              clearable={false}
                              value={f.state.value ?? MealRelation.NONE}
                              onValueChange={(v) =>
                                f.handleChange(v as MealRelation)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MEAL_RELATION_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </form.Field>
                      <form.Field name={`medicines[${idx}].duration`}>
                        {(f) => (
                          <FieldWrapper
                            error={fieldError(f)}
                            className="col-span-3"
                          >
                            <FreeSelect
                              value={f.state.value}
                              onChange={(v) => f.handleChange(v)}
                              onBlur={f.handleBlur}
                              options={DURATION_PRESETS}
                              placeholder="Duration"
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                    </div>
                    <details className="pl-7 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                        + Special instructions
                      </summary>
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <form.Field
                          name={`medicines[${idx}].specialInstructions`}
                        >
                          {(f) => (
                            <Input
                              value={f.state.value ?? ''}
                              onChange={(e) => f.handleChange(e.target.value)}
                              className="h-8 text-xs"
                              placeholder="English"
                            />
                          )}
                        </form.Field>
                        <form.Field
                          name={`medicines[${idx}].specialInstructionsUrdu`}
                        >
                          {(f) => (
                            <Input
                              value={f.state.value ?? ''}
                              onChange={(e) => f.handleChange(e.target.value)}
                              dir="rtl"
                              className="h-8 text-xs text-right"
                              style={{
                                fontFamily: "'Noto Nastaliq Urdu', serif",
                              }}
                              placeholder="اردو"
                            />
                          )}
                        </form.Field>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
              {listError(meds) && (
                <p className="text-xs font-medium text-danger">
                  {listError(meds)}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Further plan */}
        <form.Field name="furtherPlan">
          {(field) => (
            <div className="bg-card border rounded-lg p-3 space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Further Plan / Comment
              </Label>
              <FieldWrapper error={fieldError(field)}>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="resize-none h-20"
                  placeholder="Follow-up in 7 days, lab work, referrals…"
                />
              </FieldWrapper>
            </div>
          )}
        </form.Field>

        {/* Instructions */}
        <div className="bg-card border rounded-lg p-3 space-y-3">
          <form.Field name="instructionsEnglish">
            {(field) => (
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Instructions (English)
                </Label>
                <FieldWrapper error={fieldError(field)} className="mt-1">
                  <Textarea
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="resize-none h-24"
                    placeholder="Avoid salt in diet, soft drinks…"
                  />
                </FieldWrapper>
              </div>
            )}
          </form.Field>
          <form.Field name="instructionsUrdu">
            {(field) => (
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  ہدایات (Urdu)
                </Label>
                <FieldWrapper error={fieldError(field)} className="mt-1">
                  <Textarea
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    dir="rtl"
                    className="resize-none h-24 text-right"
                    style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}
                    placeholder="نمک اور مشروبات سے پرہیز…"
                  />
                </FieldWrapper>
              </div>
            )}
          </form.Field>
        </div>

        {/* Actions */}
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => {
            const busy = isSubmitting || pending
            return (
              <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background pt-2 pb-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => void form.handleSubmit({ intent: 'draft' })}
                  disabled={!canSubmit || busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  {busy ? 'Saving…' : 'Save Draft'}
                </Button>
                <Button
                  onClick={() => void form.handleSubmit({ intent: 'finalize' })}
                  disabled={!canSubmit || busy}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  )}
                  {finalized ? 'Amend & Sign' : 'Finalize & Sign'}
                </Button>
              </div>
            )
          }}
        </form.Subscribe>
      </div>

      {/* ════ RIGHT — LIVE PREVIEW ═══════════════════════════════════ */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="bg-muted/30 rounded-xl p-3 lg:p-4 border max-h-[calc(100vh-2rem)] overflow-auto">
          <PrescriptionPreview
            data={previewData}
            template={activeTemplate}
            signatureImageUrl={
              existing?.signatureImageUrl ?? mySignature?.signatureImageUrl
            }
          />
        </div>
      </div>

      {/* ════ Signature dialog ═══════════════════════════════════════ */}
      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Sign & finalize prescription</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {mySignature?.signatureImageUrl && (
              <div className="bg-muted/40 rounded-md p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Saved signature
                </p>
                <img
                  src={mySignature.signatureImageUrl}
                  alt="Saved signature"
                  className="h-16 object-contain"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Tap Confirm to use this — or draw a new one below to override
                  it.
                </p>
              </div>
            )}
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                Draw new signature
              </Label>
              <SignaturePad ref={sigPadRef} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSignatureOpen(false)}
              disabled={finalizeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmFinalize}
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              Confirm & Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** A combobox-lite: type free text or pick from presets. */
function FreeSelect({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        className="h-8 text-xs"
        placeholder={placeholder}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o)
                setOpen(false)
              }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-accent',
                o === value && 'bg-accent',
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VitalInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error?: string
  placeholder?: string
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <FieldWrapper error={error} className="mt-0.5">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          className="h-8 text-xs"
          placeholder={placeholder}
        />
      </FieldWrapper>
    </div>
  )
}
