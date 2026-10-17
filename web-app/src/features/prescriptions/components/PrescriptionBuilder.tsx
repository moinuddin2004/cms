import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
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
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import {
  useDefaultPrescriptionTemplate,
  usePrescriptionTemplates,
} from '../hooks/usePrescriptionTemplates'
import { useTreatmentPlanTemplates } from '../hooks/useTreatmentPlanTemplates'
import { useDoctors } from '@/features/appointments/hooks/useDoctors'
import {
  useCreatePrescription,
  useFinalizePrescription,
  usePrescription,
  useUpdatePrescription,
} from '../hooks/usePrescriptions'
import { useMySignature, useSaveMySignature } from '../hooks/useDoctorSignature'
import {
  MealRelation,
  PrescriptionStatus,
  type PrescriptionMedicine,
  type Prescription,
  DURATION_PRESETS,
  presetCategoryLabel,
  FREQUENCY_PRESETS,
  MEAL_RELATION_OPTIONS,
} from '../types'
import {
  MedicineAutocomplete,
  medicineFromDirectory,
} from './MedicineAutocomplete'
import { PrescriptionPreview, type PreviewData } from './PrescriptionPreview'
import {
  SignaturePad,
  type SignaturePadHandle,
} from '@/components/shared/SignaturePad'
import { fetchPrescriptionPdf } from '../services/prescriptions.api'

interface BuilderProps {
  /** Existing prescription to edit. When omitted, builder is in create mode. */
  prescriptionId?: string
  /** Pre-select patient (e.g. when launching from a patient page). */
  initialPatientId?: string
  /** Link to an appointment when creating from /appointments. */
  initialAppointmentId?: string
}

interface PatientLite {
  id: string
  fullName: string
  phone: string
  patientNumber?: string
  dob?: string | null
  gender?: string | null
}

function emptyLine(): PrescriptionMedicine {
  return {
    medicineName: '',
    dosage: '1',
    frequency: '',
    frequencyTiming: [],
    mealRelation: MealRelation.NONE,
    duration: '',
  }
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

  // ── Build / edit state ──────────────────────────────────────────────
  const [patient, setPatient] = useState<PatientLite | null>(null)
  const [diagnosis, setDiagnosis] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [furtherPlan, setFurtherPlan] = useState('')
  const [instructionsEnglish, setInstructionsEnglish] = useState('')
  const [instructionsUrdu, setInstructionsUrdu] = useState('')
  const [vitals, setVitals] = useState({
    bp: '',
    pulse: '',
    temperature: '',
    spo2: '',
    weight: '',
    height: '',
  })
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([
    emptyLine(),
  ])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [treatmentPlanTemplateId, setTreatmentPlanTemplateId] = useState<
    string | null
  >(null)
  const [doctorId, setDoctorId] = useState<string | null>(null)

  // ── Template data ──────────────────────────────────────────────────
  const { activeLocationId } = useAuthStore()
  const { data: templates = [] } = usePrescriptionTemplates(
    activeLocationId ?? undefined,
  )
  const { data: defaultTemplate } = useDefaultPrescriptionTemplate(
    activeLocationId ?? undefined,
  )
  const { data: planTemplates = [] } = useTreatmentPlanTemplates()
  const { data: doctors = [] } = useDoctors()
  const { data: mySignature } = useMySignature()
  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === doctorId) ?? null,
    [doctors, doctorId],
  )

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? defaultTemplate ?? null,
    [templates, templateId, defaultTemplate],
  )

  // ── Patient picker ──────────────────────────────────────────────────
  const [patientQuery, setPatientQuery] = useState('')
  const [patientOpen, setPatientOpen] = useState(false)
  const [patientResults, setPatientResults] = useState<PatientLite[]>([])
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
        setPatientResults(
          list.map((p: any) => ({
            id: p.id,
            fullName: p.fullName,
            phone: p.phone,
            patientNumber: p.patientNumber,
            dob: p.dob ?? null,
            gender: p.gender ?? null,
          })),
        )
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
    if (!initialPatientId || patient) return
    api
      .get(`/patients/${initialPatientId}`)
      .then(({ data }) => {
        const p = data?.data
        if (p) {
          setPatient({
            id: p.id,
            fullName: p.fullName,
            phone: p.phone,
            patientNumber: p.patientNumber,
            dob: p.dob ?? null,
            gender: p.gender ?? null,
          })
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPatientId])

  // Hydrate state from a loaded existing prescription
  useEffect(() => {
    if (!existing) return
    setPatient({
      id: existing.patient?.id ?? existing.patientId,
      fullName: existing.patient?.fullName ?? '',
      phone: existing.patient?.phone ?? '',
      patientNumber: existing.patient?.patientNumber,
      dob: existing.patient?.dob ?? null,
      gender: existing.patient?.gender ?? null,
    })
    setDiagnosis(existing.diagnosis ?? '')
    setChiefComplaint(existing.chiefComplaint ?? '')
    setFurtherPlan(existing.furtherPlan ?? '')
    setInstructionsEnglish(existing.instructionsEnglish ?? '')
    setInstructionsUrdu(existing.instructionsUrdu ?? '')
    setVitals({
      bp: existing.vitals?.bp ?? '',
      pulse: existing.vitals?.pulse ?? '',
      temperature: existing.vitals?.temperature ?? '',
      spo2: existing.vitals?.spo2 ?? '',
      weight: existing.vitals?.weight ?? '',
      height: existing.vitals?.height ?? '',
    })
    setMedicines(
      existing.medicines && existing.medicines.length > 0
        ? existing.medicines
        : [emptyLine()],
    )
    setTemplateId(existing.prescriptionTemplateId)
    setTreatmentPlanTemplateId(existing.treatmentPlanTemplateId)
    setDoctorId(existing.doctorId ?? existing.doctor?.id ?? null)
  }, [existing])

  // ── Mutations ───────────────────────────────────────────────────────
  const createMutation = useCreatePrescription()
  const updateMutation = useUpdatePrescription()
  const finalizeMutation = useFinalizePrescription()

  const buildPayload = useCallback(
    () => ({
      patientId: patient?.id,
      appointmentId: initialAppointmentId,
      doctorId: doctorId ?? undefined,
      prescriptionTemplateId: templateId ?? undefined,
      treatmentPlanTemplateId: treatmentPlanTemplateId ?? undefined,
      diagnosis: diagnosis || undefined,
      chiefComplaint: chiefComplaint || undefined,
      furtherPlan: furtherPlan || undefined,
      instructionsEnglish: instructionsEnglish || undefined,
      instructionsUrdu: instructionsUrdu || undefined,
      vitals: anyVitals(vitals) ? vitals : undefined,
      medicines: medicines
        .filter((m) => m.medicineName.trim())
        .map((m, idx) => ({ ...m, sortOrder: idx })),
    }),
    [
      patient,
      initialAppointmentId,
      doctorId,
      templateId,
      treatmentPlanTemplateId,
      diagnosis,
      chiefComplaint,
      furtherPlan,
      instructionsEnglish,
      instructionsUrdu,
      vitals,
      medicines,
    ],
  )

  const handleSaveDraft = useCallback(async () => {
    if (!patient) {
      toast.error('Please select a patient first')
      return
    }
    const payload = buildPayload()
    if (!payload.medicines || payload.medicines.length === 0) {
      toast.error('Add at least one medicine')
      return
    }
    if (isEditing && existing) {
      const updated = await updateMutation.mutateAsync({
        id: existing.id,
        data: payload as any,
      })
      toast.success('Draft saved')
      return updated
    }
    const created = await createMutation.mutateAsync(payload as any)
    toast.success('Draft created')
    ;(navigate as any)({
      to: '/prescriptions/$prescriptionId',
      params: { prescriptionId: created.id },
    })
    return created
  }, [
    patient,
    buildPayload,
    isEditing,
    existing,
    updateMutation,
    createMutation,
    navigate,
  ])

  // ── Finalize flow ───────────────────────────────────────────────────
  const [signatureOpen, setSignatureOpen] = useState(false)
  const sigPadRef = useRef<SignaturePadHandle>(null)

  const handleFinalize = async () => {
    if (!patient) {
      toast.error('Please select a patient first')
      return
    }
    const payload = buildPayload()
    if (!payload.medicines || payload.medicines.length === 0) {
      toast.error('Add at least one medicine')
      return
    }
    // Ensure we have a saved prescription first
    let target: Prescription | undefined =
      (existing as Prescription) ?? undefined
    if (!isEditing) {
      target = await createMutation.mutateAsync(payload as any)
    } else if (existing) {
      target = await updateMutation.mutateAsync({
        id: existing.id,
        data: payload as any,
      })
    }
    if (!target) return
    setSignatureOpen(true)
  }

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
    })
  }

  // ── Plan template apply ─────────────────────────────────────────────
  const applyPlanTemplate = (templateIdToApply: string) => {
    const tpl = planTemplates.find((p) => p.id === templateIdToApply)
    if (!tpl) return
    setTreatmentPlanTemplateId(tpl.id)
    setMedicines(
      tpl.medicines.map((m) => ({
        medicineDirectoryId: m.medicineDirectoryId ?? undefined,
        medicineName: m.medicineName,
        medicineNameUrdu: m.medicineNameUrdu,
        type: m.type,
        dosage: m.dosage,
        frequency: m.frequency,
        frequencyTiming: m.frequencyTiming ?? [],
        mealRelation: m.mealRelation,
        duration: m.duration,
        specialInstructions: m.specialInstructions,
        specialInstructionsUrdu: m.specialInstructionsUrdu,
      })),
    )
    if (!furtherPlan && tpl.furtherPlan) setFurtherPlan(tpl.furtherPlan)
    if (!instructionsEnglish && tpl.instructionsEnglish)
      setInstructionsEnglish(tpl.instructionsEnglish)
    if (!instructionsUrdu && tpl.instructionsUrdu)
      setInstructionsUrdu(tpl.instructionsUrdu)
    toast.success(`Applied template: ${tpl.name}`)
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
      diagnosis,
      chiefComplaint,
      furtherPlan,
      instructionsEnglish,
      instructionsUrdu,
      vitals,
      medicines,
    }),
    [
      existing,
      patient,
      selectedDoctor,
      diagnosis,
      chiefComplaint,
      furtherPlan,
      instructionsEnglish,
      instructionsUrdu,
      vitals,
      medicines,
    ],
  )

  if (isEditing && loadingExisting) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const finalized = existing?.status === PrescriptionStatus.FINALIZED
  const readOnly = false // amendments allowed — finalize amends via the same flow

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
              {planTemplates.length === 0 && (
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
                    <Link to={'/prescription-presets' as any}>
                      <Plus className="h-3 w-3 mr-1" /> Create one
                    </Link>
                  </Button>
                </div>
              )}
              {planTemplates.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => applyPlanTemplate(p.id)}
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
              {planTemplates.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to={'/prescription-presets' as any}
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
              <Link to={'/prescription-templates' as any}>
                <LayoutTemplate className="h-3 w-3 mr-1.5" />
                Set up layout
              </Link>
            </Button>
          ) : (
            <Select
              clearable={false}
              value={templateId ?? defaultTemplate?.id ?? ''}
              onValueChange={(v) => setTemplateId(v)}
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
        <div className="bg-card border rounded-lg p-3 space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Patient
          </Label>
          {patient ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{patient.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {patient.patientNumber ?? ''} · {patient.phone}
                </p>
              </div>
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPatient(null)}
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
                      onClick={() => {
                        setPatient(p)
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
        </div>

        {/* Doctor */}
        <div className="bg-card border rounded-lg p-3 space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Prescribing Doctor
          </Label>
          <Select
            value={doctorId ?? ''}
            onValueChange={(v) => setDoctorId(v || null)}
          >
            <SelectTrigger className="h-9">
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
        </div>

        {/* Complaint / diagnosis */}
        <div className="bg-card border rounded-lg p-3 space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Chief Complaint
            </Label>
            <Input
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="h-9 mt-1"
              placeholder="What brought the patient in today?"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Diagnosis
            </Label>
            <Input
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="h-9 mt-1"
              placeholder="e.g. Dental caries, Gingivitis"
            />
          </div>
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
            <VitalInput
              label="BP"
              value={vitals.bp}
              onChange={(v) => setVitals({ ...vitals, bp: v })}
              placeholder="120/80"
            />
            <VitalInput
              label="Pulse"
              value={vitals.pulse}
              onChange={(v) => setVitals({ ...vitals, pulse: v })}
              placeholder="72"
            />
            <VitalInput
              label="Temp"
              value={vitals.temperature}
              onChange={(v) => setVitals({ ...vitals, temperature: v })}
              placeholder="37°C"
            />
            <VitalInput
              label="SpO₂"
              value={vitals.spo2}
              onChange={(v) => setVitals({ ...vitals, spo2: v })}
              placeholder="98%"
            />
            <VitalInput
              label="Weight"
              value={vitals.weight}
              onChange={(v) => setVitals({ ...vitals, weight: v })}
              placeholder="kg"
            />
            <VitalInput
              label="Height"
              value={vitals.height}
              onChange={(v) => setVitals({ ...vitals, height: v })}
              placeholder="cm"
            />
          </div>
        </details>

        {/* Medicines */}
        <div className="bg-card border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Medicines
            </Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMedicines([...medicines, emptyLine()])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add medicine
            </Button>
          </div>
          <div className="space-y-3">
            {medicines.map((med, idx) => (
              <MedicineRow
                key={idx}
                index={idx}
                medicine={med}
                onChange={(updated) => {
                  const next = [...medicines]
                  next[idx] = updated
                  setMedicines(next)
                }}
                onRemove={() => {
                  const next = medicines.filter((_, i) => i !== idx)
                  setMedicines(next.length > 0 ? next : [emptyLine()])
                }}
              />
            ))}
          </div>
        </div>

        {/* Further plan */}
        <div className="bg-card border rounded-lg p-3 space-y-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Further Plan / Comment
          </Label>
          <Textarea
            value={furtherPlan}
            onChange={(e) => setFurtherPlan(e.target.value)}
            className="resize-none h-20"
            placeholder="Follow-up in 7 days, lab work, referrals…"
          />
        </div>

        {/* Instructions */}
        <div className="bg-card border rounded-lg p-3 space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Instructions (English)
            </Label>
            <Textarea
              value={instructionsEnglish}
              onChange={(e) => setInstructionsEnglish(e.target.value)}
              className="resize-none h-24 mt-1"
              placeholder="Avoid salt in diet, soft drinks…"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              ہدایات (Urdu)
            </Label>
            <Textarea
              value={instructionsUrdu}
              onChange={(e) => setInstructionsUrdu(e.target.value)}
              dir="rtl"
              className="resize-none h-24 mt-1 text-right"
              style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}
              placeholder="نمک اور مشروبات سے پرہیز…"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background pt-2 pb-2 border-t">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={
              readOnly || createMutation.isPending || updateMutation.isPending
            }
          >
            <Save className="h-4 w-4 mr-1.5" />
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving…'
              : 'Save Draft'}
          </Button>
          <Button onClick={handleFinalize} disabled={readOnly}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {finalized ? 'Amend & Sign' : 'Finalize & Sign'}
          </Button>
        </div>
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

// ─── Medicine row ─────────────────────────────────────────────────────

function MedicineRow({
  index,
  medicine,
  onChange,
  onRemove,
}: {
  index: number
  medicine: PrescriptionMedicine
  onChange: (m: PrescriptionMedicine) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground font-mono w-5 text-center">
          {index + 1}.
        </span>
        <div className="flex-1">
          <MedicineAutocomplete
            value={medicine.medicineName}
            onChange={(v) => onChange({ ...medicine, medicineName: v })}
            onPick={(picked) =>
              onChange({ ...medicine, ...medicineFromDirectory(picked) })
            }
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-12 gap-2 pl-7">
        <div className="col-span-2">
          <Input
            value={medicine.dosage}
            onChange={(e) => onChange({ ...medicine, dosage: e.target.value })}
            className="h-8 text-xs"
            placeholder="Dose"
          />
        </div>
        <div className="col-span-4">
          <FreeSelect
            value={medicine.frequency}
            onChange={(v) => onChange({ ...medicine, frequency: v })}
            options={FREQUENCY_PRESETS}
            placeholder="Frequency"
          />
        </div>
        <div className="col-span-3">
          <Select
            clearable={false}
            value={medicine.mealRelation ?? MealRelation.NONE}
            onValueChange={(v) =>
              onChange({ ...medicine, mealRelation: v as MealRelation })
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
        <div className="col-span-3">
          <FreeSelect
            value={medicine.duration}
            onChange={(v) => onChange({ ...medicine, duration: v })}
            options={DURATION_PRESETS}
            placeholder="Duration"
          />
        </div>
      </div>
      <details className="pl-7 [&_summary::-webkit-details-marker]:hidden">
        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
          + Special instructions
        </summary>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <Input
            value={medicine.specialInstructions ?? ''}
            onChange={(e) =>
              onChange({ ...medicine, specialInstructions: e.target.value })
            }
            className="h-8 text-xs"
            placeholder="English"
          />
          <Input
            value={medicine.specialInstructionsUrdu ?? ''}
            onChange={(e) =>
              onChange({
                ...medicine,
                specialInstructionsUrdu: e.target.value,
              })
            }
            dir="rtl"
            className="h-8 text-xs text-right"
            style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}
            placeholder="اردو"
          />
        </div>
      </details>
    </div>
  )
}

/** A combobox-lite: type free text or pick from presets. */
function FreeSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
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
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs mt-0.5"
        placeholder={placeholder}
      />
    </div>
  )
}

function anyVitals(v: Record<string, string>): boolean {
  return Object.values(v).some((x) => x.trim() !== '')
}
