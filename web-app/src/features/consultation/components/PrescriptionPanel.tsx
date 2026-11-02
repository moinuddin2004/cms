import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  FileSignature,
  LayoutTemplate,
  Loader2,
  Pencil,
  Pill,
  Plus,
  Printer,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignaturePad } from '@/components/shared/SignaturePad'
import type { SignaturePadHandle } from '@/components/shared/SignaturePad'
import type { PatientVitals } from '@/features/patients'
import {
  MedicineAutocomplete,
  PrescriptionStatus,
  createPrescription,
  fetchPrescriptionPdf,
  medicineFromDirectory,
  updatePrescription,
  useFinalizePrescription,
  useMedicines,
  useMySignature,
  usePrescriptionsByEncounter,
  usePrescriptionsByPatient,
  useSaveMySignature,
  usePrescriptionPresets,
} from '@/features/prescriptions'
import type {
  MedicineDirectoryItem,
  PrescriptionMedicine,
} from '@/features/prescriptions'
import { PRESCRIPTIONS_KEY } from '@/features/prescriptions/hooks/usePrescriptions'
import { useAutosave } from '../hooks/useAutosave'
import type { VisitNotes } from '../types'
import { MedicineLine, isLineComplete } from './MedicineLine'
import type { RxLine } from './MedicineLine'
import { Chip } from './Chip'
import { Panel, PanelBadge } from './Panel'
import { PdfPreviewDialog } from './PdfPreviewDialog'
import { SaveBadge } from './SaveBadge'

/** Medicines handed to the panel from elsewhere on the screen (e.g. "use these again"). */
export interface RxCommand {
  medicines: PrescriptionMedicine[]
  /** Changes on every request so the same command can be sent twice. */
  nonce: number
}

let lineSeq = 0
const newKey = () => `line-${++lineSeq}`

const toLine = (m: PrescriptionMedicine): RxLine => ({
  medicineDirectoryId: m.medicineDirectoryId ?? undefined,
  medicineName: m.medicineName,
  medicineNameUrdu: m.medicineNameUrdu ?? undefined,
  type: m.type ?? undefined,
  dosage: m.dosage || '1',
  frequency: m.frequency,
  frequencyTiming: m.frequencyTiming ?? [],
  mealRelation: m.mealRelation,
  duration: m.duration,
  specialInstructions: m.specialInstructions ?? undefined,
  specialInstructionsUrdu: m.specialInstructionsUrdu ?? undefined,
  key: newKey(),
})

const toPayload = (l: RxLine, idx: number): PrescriptionMedicine => {
  const { key: _key, id: _id, ...rest } = l
  return { ...rest, sortOrder: idx }
}

/** Today's recorded vitals in the shape the printed prescription uses. */
function vitalsForRx(
  v: PatientVitals | null | undefined,
  visitDate: string,
): Record<string, string> | undefined {
  if (!v) return undefined
  const day = (iso: string) => format(new Date(iso), 'yyyy-MM-dd')
  if (day(v.recordedAt) !== day(visitDate)) return undefined
  const out: Record<string, string> = {}
  if (v.bpSystolic != null && v.bpDiastolic != null) {
    out.bp = `${v.bpSystolic}/${v.bpDiastolic}`
  }
  if (v.pulseRate != null) out.pulse = String(v.pulseRate)
  if (v.temperature != null) out.temperature = String(v.temperature)
  if (v.oxygenSaturation != null) out.spo2 = String(v.oxygenSaturation)
  if (v.weightKg != null) out.weight = String(v.weightKg)
  if (v.heightCm != null) out.height = String(v.heightCm)
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * The prescription, written inside the consultation. It starts as a draft
 * after the first medicine and saves itself; diagnosis, advice, follow-up and
 * today's vitals are taken from the visit notes so nothing is typed twice.
 */
export function PrescriptionPanel({
  encounterId,
  encounterDate,
  patientId,
  doctorId,
  notes,
  latestVitals,
  command,
  onTemplateAdvice,
  registerFlush,
}: {
  encounterId: string
  encounterDate: string
  patientId: string
  doctorId: string | null
  notes: VisitNotes
  latestVitals: PatientVitals | null | undefined
  command: RxCommand | null
  /** A preset brought its own advice text — offer it to the notes. */
  onTemplateAdvice: (text: string) => void
  /** Lets the screen save the prescription before it completes the visit. */
  registerFlush: (flush: () => Promise<boolean>) => void
}) {
  const queryClient = useQueryClient()
  const { data: forVisit, isLoading } = usePrescriptionsByEncounter(encounterId)
  const { data: forPatient } = usePrescriptionsByPatient(patientId, 1, 5)
  const { data: directory = [] } = useMedicines()
  const { data: presets = [] } = usePrescriptionPresets()
  const { data: mySignature } = useMySignature()
  const finalizeMutation = useFinalizePrescription()
  const saveSignature = useSaveMySignature()

  const existing = forVisit?.[0]
  const [rxId, setRxId] = useState<string | null>(null)
  const rxIdRef = useRef<string | null>(null)
  const [lines, setLines] = useState<RxLine[]>([])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [amending, setAmending] = useState(false)
  const [sigOpen, setSigOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const sigPad = useRef<SignaturePadHandle>(null)
  const hydrated = useRef(false)

  // Load a prescription that already exists for this visit — once.
  useEffect(() => {
    if (isLoading || hydrated.current) return
    hydrated.current = true
    if (!existing) return
    rxIdRef.current = existing.id
    setRxId(existing.id)
    setLines(
      [...existing.medicines]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(toLine),
    )
  }, [isLoading, existing])

  const status = existing?.status
  const isFinal = status === PrescriptionStatus.FINALIZED && !amending
  const completeLines = useMemo(() => lines.filter(isLineComplete), [lines])

  // ── Add medicines ───────────────────────────────────────────────────
  const linesRef = useRef(lines)
  linesRef.current = lines
  const addLines = useCallback((meds: PrescriptionMedicine[]) => {
    const have = new Set(
      linesRef.current.map((l) => l.medicineName.toLowerCase()),
    )
    const fresh = meds
      .filter((m) => !have.has(m.medicineName.toLowerCase()))
      .map(toLine)
    if (fresh.length === 0) return
    setLines((prev) => [...prev, ...fresh])
    // A medicine that still needs choices opens straight away.
    const open = fresh.find((l) => !isLineComplete(l))
    if (open) setExpandedKey(open.key)
  }, [])

  const addFromDirectory = (m: MedicineDirectoryItem) => {
    addLines([medicineFromDirectory(m)])
    setQuery('')
  }

  const addCustom = () => {
    const name = query.trim()
    if (name.length < 2) return
    addLines([{ medicineName: name, dosage: '1', frequency: '', duration: '' }])
    setQuery('')
  }

  const lastCommand = useRef<number | null>(null)
  useEffect(() => {
    if (!command || lastCommand.current === command.nonce) return
    lastCommand.current = command.nonce
    addLines(command.medicines)
    toast.success('Medicines added to the prescription')
  }, [command, addLines])

  // "Repeat last": the most recent signed prescription from an earlier visit.
  const lastRx = useMemo(
    () =>
      (forPatient?.data ?? []).find(
        (p) =>
          p.encounterId !== encounterId &&
          p.status !== PrescriptionStatus.DRAFT &&
          p.medicines.length > 0,
      ),
    [forPatient, encounterId],
  )

  // ── Save ────────────────────────────────────────────────────────────
  const rxFields = useMemo(
    () => ({
      chiefComplaint: notes.chiefComplaint.trim() || undefined,
      diagnosis: notes.diagnosis.trim() || undefined,
      instructionsEnglish: notes.advice.trim() || undefined,
      furtherPlan: notes.followUpDate
        ? `Follow-up: ${format(new Date(`${notes.followUpDate}T12:00:00`), 'dd MMM yyyy')}`
        : undefined,
      vitals: vitalsForRx(latestVitals, encounterDate),
    }),
    [notes, latestVitals, encounterDate],
  )

  const persist = useCallback(
    async (snapshot: {
      medicines: PrescriptionMedicine[]
      rxFields: typeof rxFields
    }) => {
      if (snapshot.medicines.length === 0 && !rxIdRef.current) return
      const body = { ...snapshot.rxFields, medicines: snapshot.medicines }
      if (rxIdRef.current) {
        await updatePrescription(rxIdRef.current, body)
      } else {
        const created = await createPrescription({
          patientId,
          encounterId,
          doctorId: doctorId ?? undefined,
          ...body,
        })
        rxIdRef.current = created.id
        setRxId(created.id)
      }
      void queryClient.invalidateQueries({
        queryKey: [PRESCRIPTIONS_KEY, 'encounter', encounterId],
      })
    },
    [patientId, encounterId, doctorId, queryClient],
  )

  const autosaveValue = useMemo(
    () => ({
      medicines: completeLines.map(toPayload),
      rxFields,
    }),
    [completeLines, rxFields],
  )
  const autosave = useAutosave(autosaveValue, persist, {
    delay: 1000,
    enabled: !isLoading && !isFinal,
  })

  useEffect(() => {
    registerFlush(autosave.flush)
  }, [registerFlush, autosave.flush])

  // ── Finalize & print ────────────────────────────────────────────────
  // The PDF opens in an in-app preview (with Print), never in a pop-up tab:
  // a tab opened before the PDF is ready just shows a blank page.
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const closePdf = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
  }

  const showPdf = async (id: string) => {
    const blob = await fetchPrescriptionPdf(id)
    setPdfUrl(
      URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })),
    )
  }

  const finalizeWith = async (signatureImageUrl: string) => {
    const id = rxIdRef.current
    if (!id) return false
    try {
      await finalizeMutation.mutateAsync({ id, data: { signatureImageUrl } })
      setAmending(false)
    } catch (err) {
      const msg = isAxiosError<{ message?: string | string[] }>(err)
        ? err.response?.data.message
        : undefined
      toast.error(
        (Array.isArray(msg) ? msg[0] : msg) ||
          'Could not sign the prescription — try again',
      )
      return false
    }
    try {
      await showPdf(id)
    } catch {
      toast.error('Signed, but the PDF could not be opened — tap Print')
    }
    return true
  }

  const startFinalize = async () => {
    const half = lines.find((l) => l.medicineName.trim() && !isLineComplete(l))
    if (half) {
      setExpandedKey(half.key)
      toast.error('Choose how often and for how long for every medicine')
      return
    }
    if (completeLines.length === 0) {
      toast.error('Add at least one medicine')
      return
    }
    setBusy(true)
    try {
      let saved = await autosave.flush()
      // Amend with no edits: the server still has it as signed and would
      // refuse to sign it again — save once so it becomes an amendment.
      if (saved && amending && rxIdRef.current) {
        saved = await persist(autosaveValue).then(
          () => true,
          () => false,
        )
      }
      if (!saved || !rxIdRef.current) {
        toast.error('Could not save the prescription — try again')
        return
      }
      const signature = mySignature?.signatureImageUrl
      if (!signature) {
        setSigOpen(true)
        return
      }
      await finalizeWith(signature)
    } finally {
      setBusy(false)
    }
  }

  const confirmSignature = async () => {
    const dataUrl = sigPad.current?.isEmpty()
      ? null
      : sigPad.current?.toDataURL()
    if (!dataUrl) {
      toast.error('Please sign in the box first')
      return
    }
    setBusy(true)
    try {
      await saveSignature.mutateAsync({ signatureImageUrl: dataUrl })
    } catch {
      // Saving it for next time is a convenience — finalize anyway.
    }
    try {
      if (await finalizeWith(dataUrl)) setSigOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const [printing, setPrinting] = useState(false)
  const printAgain = async () => {
    if (!rxId) return
    setPrinting(true)
    try {
      await showPdf(rxId)
    } catch {
      toast.error('Could not open the prescription PDF')
    } finally {
      setPrinting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────
  const suggestions = directory
    .filter((m) => m.isActive)
    .slice(0, 8)
    .filter((m) => !lines.some((l) => l.medicineName === m.name))

  return (
    <Panel
      icon={<Pill />}
      title="Prescription"
      badge={
        existing ? (
          <PanelBadge tone={isFinal ? 'success' : 'warning'}>
            {isFinal
              ? `Signed · ${existing.prescriptionNumber}`
              : amending || status === PrescriptionStatus.AMENDED
                ? 'Amending'
                : 'Draft'}
          </PanelBadge>
        ) : undefined
      }
      action={
        !isFinal && (rxId || lines.length > 0) ? (
          <SaveBadge state={autosave.state} savedAt={autosave.savedAt} />
        ) : undefined
      }
    >
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-3">
          {!isFinal && (
            <>
              <div className="flex flex-wrap gap-2">
                {lastRx && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      addLines(lastRx.medicines)
                      toast.success('Last prescription added')
                    }}
                  >
                    <Repeat className="size-4" /> Repeat last
                  </Button>
                )}
                {presets.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                      >
                        <LayoutTemplate className="size-4" /> Use a preset
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="max-h-80 w-72 overflow-y-auto"
                    >
                      <DropdownMenuLabel>
                        Prescription presets
                      </DropdownMenuLabel>
                      {presets.map((t) => (
                        <DropdownMenuItem
                          key={t.id}
                          className="min-h-9"
                          onSelect={() => {
                            addLines(t.medicines)
                            if (t.instructionsEnglish) {
                              onTemplateAdvice(t.instructionsEnglish)
                            }
                          }}
                        >
                          {t.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <div className="flex gap-2">
                <MedicineAutocomplete
                  value={query}
                  onChange={setQuery}
                  onPick={addFromDirectory}
                  placeholder="Search medicine…"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 shrink-0"
                  disabled={query.trim().length < 2}
                  onClick={addCustom}
                >
                  <Plus className="size-4" /> Add “{query.trim() || '…'}”
                </Button>
              </div>

              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((m) => (
                    <Chip
                      key={m.id}
                      onClick={() => addLines([medicineFromDirectory(m)])}
                    >
                      <Plus className="size-3.5" /> {m.name}
                    </Chip>
                  ))}
                </div>
              )}
            </>
          )}

          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-center text-[13px] text-muted-foreground">
              No medicines yet. Search above, tap a common one, or use a
              template.
            </p>
          ) : (
            <ul className="space-y-2">
              {lines.map((l) => (
                <MedicineLine
                  key={l.key}
                  line={l}
                  expanded={expandedKey === l.key}
                  readOnly={isFinal}
                  onToggle={() =>
                    setExpandedKey(expandedKey === l.key ? null : l.key)
                  }
                  onChange={(patch) =>
                    setLines((prev) =>
                      prev.map((x) =>
                        x.key === l.key ? { ...x, ...patch } : x,
                      ),
                    )
                  }
                  onRemove={() =>
                    setLines((prev) => prev.filter((x) => x.key !== l.key))
                  }
                />
              ))}
            </ul>
          )}

          <p className="text-[11px] leading-snug text-muted-foreground">
            Diagnosis, advice, next visit and today’s vitals from your notes are
            printed on the prescription automatically.
          </p>

          <div className="flex flex-wrap gap-2">
            {isFinal ? (
              <>
                <Button
                  className="h-9 px-4"
                  disabled={printing}
                  onClick={() => void printAgain()}
                >
                  {printing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Printer className="size-4" />
                  )}
                  Print
                </Button>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => setAmending(true)}
                >
                  <Pencil className="size-4" /> Amend
                </Button>
              </>
            ) : (
              <Button
                className="h-9 px-4"
                disabled={busy || completeLines.length === 0}
                onClick={() => void startFinalize()}
              >
                {busy || finalizeMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Printer className="size-4" />
                )}
                {status === PrescriptionStatus.AMENDED || amending
                  ? 'Sign amendment & print'
                  : 'Sign & print'}
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={sigOpen} onOpenChange={(o) => !busy && setSigOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="size-5" /> Sign the prescription
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sign with your finger or mouse. It is saved, so you only do this
            once.
          </p>
          <SignaturePad ref={sigPad} height={200} />
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11"
              disabled={busy}
              onClick={() => setSigOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-11"
              disabled={busy}
              onClick={() => void confirmSignature()}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sign & print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewDialog
        url={pdfUrl}
        title={`Prescription ${existing?.prescriptionNumber ?? ''}`.trim()}
        onClose={closePdf}
      />
    </Panel>
  )
}
