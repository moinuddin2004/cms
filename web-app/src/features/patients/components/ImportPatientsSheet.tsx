import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { FormSheet } from '@/components/forms/FormSheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { cn } from '@/lib/utils'
import {
  useParsePatientImport,
  usePatientImportDryRun,
  useRunPatientImport,
} from '../hooks/usePatientImport'
import { PATIENTS_QUERY_KEY } from '../hooks/usePatients'
import type {
  DuplicateStrategy,
  ParsedPatientImport,
  PatientImportResult,
  PatientImportRow,
  PatientImportRowResult,
} from '../types'
import {
  IGNORE_COLUMN,
  IMPORT_ACCEPT,
  IMPORT_FIELD_DEFS,
  IMPORT_FIELD_LABEL,
  IMPORT_MAX_FILE_MB,
  applyMapping,
  downloadErrorReport,
  downloadSampleTemplate,
  missingRequired,
} from '../utils/patientImport'
import type { ColumnMapping } from '../utils/patientImport'

type Step = 'upload' | 'map' | 'check' | 'import' | 'summary'

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map columns' },
  { id: 'check', label: 'Check' },
  { id: 'import', label: 'Import' },
  { id: 'summary', label: 'Summary' },
]

/** Problem rows shown on screen; the error report has all of them. */
const MAX_PROBLEM_ROWS = 200

interface ImportPatientsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Migrate existing patients from an Excel (.xlsx) or CSV file:
 * upload → map columns → dry-run check → import in batches → summary.
 */
export function ImportPatientsSheet({
  open,
  onOpenChange,
}: ImportPatientsSheetProps) {
  const queryClient = useQueryClient()
  const parseMutation = useParsePatientImport()
  const dryRunMutation = usePatientImportDryRun()
  const importMutation = useRunPatientImport()

  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedPatientImport | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip')
  const [check, setCheck] = useState<PatientImportResult | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<PatientImportResult | null>(null)

  const mappedRows = useMemo<PatientImportRow[]>(
    () => (parsed ? parsed.rows.map((r) => applyMapping(r, mapping)) : []),
    [parsed, mapping],
  )
  const missing = missingRequired(mapping)
  const importing = step === 'import'

  const reset = () => {
    setStep('upload')
    setFileName('')
    setParsed(null)
    setMapping({})
    setStrategy('skip')
    setCheck(null)
    setProgress({ done: 0, total: 0 })
    setResult(null)
    parseMutation.reset()
    dryRunMutation.reset()
    importMutation.reset()
  }

  const close = () => {
    if (importing) return // never abandon a running import
    if (result)
      queryClient.invalidateQueries({ queryKey: [PATIENTS_QUERY_KEY] })
    reset()
    onOpenChange(false)
  }

  const handleFile = (file: File) => {
    setFileName(file.name)
    parseMutation.mutate(file, {
      onSuccess: (data) => {
        setParsed(data)
        setMapping(
          Object.fromEntries(
            data.headers.map((h) => [
              h,
              data.suggestedMapping[h] ?? IGNORE_COLUMN,
            ]),
          ),
        )
        setStep('map')
      },
    })
  }

  const runCheck = (dup: DuplicateStrategy) => {
    dryRunMutation.mutate(
      { rows: mappedRows, duplicateStrategy: dup },
      {
        onSuccess: (data) => {
          setCheck(data)
          setStep('check')
        },
      },
    )
  }

  const changeStrategy = (dup: DuplicateStrategy) => {
    if (dup === strategy) return
    setStrategy(dup)
    runCheck(dup)
  }

  const runImport = () => {
    setStep('import')
    importMutation.mutate(
      {
        rows: mappedRows,
        duplicateStrategy: strategy,
        onProgress: (done, total) => setProgress({ done, total }),
      },
      {
        onSuccess: (data) => {
          setResult(data)
          setStep('summary')
        },
        onError: () => setStep('check'),
      },
    )
  }

  const footer = (() => {
    switch (step) {
      case 'upload':
        return (
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
        )
      case 'map':
        return (
          <>
            <Button
              variant="outline"
              onClick={() => setStep('upload')}
              disabled={dryRunMutation.isPending}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            <Button
              onClick={() => runCheck(strategy)}
              disabled={missing.length > 0 || dryRunMutation.isPending}
            >
              {dryRunMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Check {mappedRows.length.toLocaleString()} rows
            </Button>
          </>
        )
      case 'check':
        return (
          <>
            <Button
              variant="outline"
              onClick={() => setStep('map')}
              disabled={dryRunMutation.isPending}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
            <Button
              onClick={runImport}
              disabled={
                !check ||
                check.totals.wouldCreate === 0 ||
                dryRunMutation.isPending ||
                importMutation.isPending
              }
            >
              {importMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Import {(check?.totals.wouldCreate ?? 0).toLocaleString()}{' '}
              patients
            </Button>
          </>
        )
      case 'import':
        return (
          <Button disabled>
            <Loader2 className="size-3.5 animate-spin" />
            Importing…
          </Button>
        )
      case 'summary':
        return (
          <>
            {result &&
              parsed &&
              result.totals.errors + result.totals.duplicates > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadErrorReport(
                      parsed.headers,
                      parsed.rows,
                      result.rows,
                    )
                  }
                >
                  <Download className="size-3.5" />
                  Download error report
                </Button>
              )}
            <Button onClick={close}>Done</Button>
          </>
        )
    }
  })()

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) close()
      }}
      title="Import patients"
      description="Bring your existing patient list in from Excel (.xlsx) or CSV."
      widthClassName="sm:max-w-5xl"
      footer={footer}
    >
      <div className="space-y-6">
        <StepIndicator current={step} />

        {step === 'upload' && (
          <UploadStep
            onFile={handleFile}
            isParsing={parseMutation.isPending}
            fileName={fileName}
          />
        )}

        {step === 'map' && parsed && (
          <MapStep
            parsed={parsed}
            mapping={mapping}
            onChange={setMapping}
            mappedRows={mappedRows}
            missing={missing}
            fileName={fileName}
          />
        )}

        {step === 'check' && check && (
          <CheckStep
            check={check}
            mappedRows={mappedRows}
            strategy={strategy}
            onStrategyChange={changeStrategy}
            isChecking={dryRunMutation.isPending}
          />
        )}

        {step === 'import' && (
          <ImportProgress done={progress.done} total={progress.total} />
        )}

        {step === 'summary' && result && (
          <SummaryStep result={result} mappedRows={mappedRows} />
        )}
      </div>
    </FormSheet>
  )
}

// ─── Steps ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const at = STEPS.findIndex((s) => s.id === current)
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-full border text-[11px] font-semibold',
              i < at && 'border-primary bg-primary text-primary-foreground',
              i === at && 'border-primary text-primary',
              i > at && 'border-border text-muted-foreground',
            )}
          >
            {i + 1}
          </span>
          <span
            className={cn(
              i === at
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  )
}

function UploadStep({
  onFile,
  isParsing,
  fileName,
}: {
  onFile: (file: File) => void
  isParsing: boolean
  fileName: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = (file: File | undefined) => {
    if (!file) return
    setError(null)
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext !== 'xlsx' && ext !== 'csv') {
      setError(
        ext === 'xls'
          ? 'Old .xls files are not supported — open it in Excel and "Save as" .xlsx.'
          : 'Choose an Excel (.xlsx) or CSV file.',
      )
      return
    }
    if (file.size > IMPORT_MAX_FILE_MB * 1024 * 1024) {
      setError(`The file is larger than ${IMPORT_MAX_FILE_MB} MB.`)
      return
    }
    onFile(file)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={isParsing}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!isParsing) pick(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30',
          isParsing && 'cursor-wait opacity-70',
        )}
      >
        {isParsing ? (
          <>
            <Loader2 className="size-7 animate-spin text-primary" />
            <span className="text-sm font-medium">Reading {fileName}…</span>
          </>
        ) : (
          <>
            <UploadCloud className="size-7 text-muted-foreground" />
            <span className="text-sm font-medium">
              Click to choose a file or drag &amp; drop it here
            </span>
            <span className="text-xs text-muted-foreground">
              Excel (.xlsx) or CSV, up to {IMPORT_MAX_FILE_MB} MB and 5,000
              patients. The first sheet is used; its first row must be the
              column names.
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            Not sure how to lay out the file?
          </p>
          <p className="text-xs text-muted-foreground">
            Use the template, or upload your own sheet — you will match its
            columns to patient fields next. Only name and phone are required.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadSampleTemplate}>
          <Download className="size-3.5" />
          Download sample template
        </Button>
      </div>
    </div>
  )
}

function MapStep({
  parsed,
  mapping,
  onChange,
  mappedRows,
  missing,
  fileName,
}: {
  parsed: ParsedPatientImport
  mapping: ColumnMapping
  onChange: (m: ColumnMapping) => void
  mappedRows: PatientImportRow[]
  missing: string[]
  fileName: string
}) {
  const example = (header: string) =>
    parsed.rows.find((r) => (r[header] ?? '').trim() !== '')?.[header] ?? ''

  const setField = (header: string, value: string) => {
    const field = (value || IGNORE_COLUMN) as ColumnMapping[string]
    const next: ColumnMapping = { ...mapping, [header]: field }
    // A field takes one column: the column that had it is released.
    if (field !== IGNORE_COLUMN) {
      for (const [h, f] of Object.entries(next)) {
        if (h !== header && f === field) next[h] = IGNORE_COLUMN
      }
    }
    onChange(next)
  }

  const previewFields = IMPORT_FIELD_DEFS.filter((f) =>
    Object.values(mapping).includes(f.key),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="size-4" />
        <span className="font-medium text-foreground">{fileName}</span>
        <span>
          · {parsed.rows.length.toLocaleString()} rows · {parsed.headers.length}{' '}
          columns
        </span>
      </div>

      {missing.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber-soft p-3 text-sm text-amber">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Choose the column that holds: <strong>{missing.join(', ')}</strong>.
          </span>
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Match columns to patient fields</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column in your file</TableHead>
                <TableHead>Example value</TableHead>
                <TableHead className="w-[260px]">Import as</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.headers.map((h) => (
                <TableRow
                  key={h}
                  className="transition-colors hover:bg-muted/40"
                >
                  <TableCell className="font-medium">{h}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">
                    {example(h) || '—'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping[h] ?? IGNORE_COLUMN}
                      onValueChange={(v) => setField(h, v)}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-[240px]"
                        aria-label={`Patient field for column ${h}`}
                      >
                        <SelectValue placeholder="Don't import" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE_COLUMN}>
                          Don't import
                        </SelectItem>
                        {IMPORT_FIELD_DEFS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                            {(f.key === 'fullName' || f.key === 'phone') &&
                              ' *'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldHint field={mapping[h]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          * Required: full name (or first name) and phone. Every imported
          patient is tagged “imported”.
        </p>
      </section>

      {previewFields.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Preview (first 5 rows)</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  {previewFields.map((f) => (
                    <TableHead key={f.key}>{f.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappedRows.slice(0, 5).map((row, i) => (
                  <TableRow
                    key={i}
                    className="transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    {previewFields.map((f) => (
                      <TableCell key={f.key} className="max-w-[200px] truncate">
                        {row[f.key] || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  )
}

function FieldHint({ field }: { field: ColumnMapping[string] | undefined }) {
  const hint = IMPORT_FIELD_DEFS.find((f) => f.key === field)?.hint
  return hint ? (
    <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
  ) : null
}

function CheckStep({
  check,
  mappedRows,
  strategy,
  onStrategyChange,
  isChecking,
}: {
  check: PatientImportResult
  mappedRows: PatientImportRow[]
  strategy: DuplicateStrategy
  onStrategyChange: (s: DuplicateStrategy) => void
  isChecking: boolean
}) {
  const { totals } = check
  return (
    <div className={cn('space-y-6', isChecking && 'opacity-60')}>
      <div className="grid gap-3 sm:grid-cols-3">
        <CountCard
          icon={CheckCircle2}
          tone="success"
          label="Ready to import"
          value={totals.wouldCreate}
        />
        <CountCard
          icon={AlertTriangle}
          tone="warning"
          label="Duplicates"
          value={totals.duplicates}
        />
        <CountCard
          icon={XCircle}
          tone="danger"
          label="Rows with errors"
          value={totals.errors}
        />
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">
          When a patient already exists (same phone or CNIC)
        </h3>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <StrategyOption
            selected={strategy === 'skip'}
            disabled={isChecking}
            onSelect={() => onStrategyChange('skip')}
            title="Skip the row"
            description="Keep the existing patient; the row goes to the error report."
          />
          <StrategyOption
            selected={strategy === 'create'}
            disabled={isChecking}
            onSelect={() => onStrategyChange('create')}
            title="Create anyway"
            description="Add a new patient for same-CNIC rows. Rows sharing a phone number still can't be created — phone numbers are unique."
          />
        </div>
        {isChecking && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking again…
          </p>
        )}
      </section>

      <ProblemRows
        title="Rows that will not be imported"
        results={check.rows}
        mappedRows={mappedRows}
        emptyText="Every row is ready to import."
      />
    </div>
  )
}

function ImportProgress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="space-y-3 py-10">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin text-primary" />
          Importing patients…
        </span>
        <span className="text-muted-foreground">
          {done.toLocaleString()} of {total.toLocaleString()} rows
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Keep this panel open until the import finishes.
      </p>
    </div>
  )
}

function SummaryStep({
  result,
  mappedRows,
}: {
  result: PatientImportResult
  mappedRows: PatientImportRow[]
}) {
  const { totals } = result
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <CountCard
          icon={CheckCircle2}
          tone="success"
          label="Patients imported"
          value={totals.created}
        />
        <CountCard
          icon={AlertTriangle}
          tone="warning"
          label="Skipped as duplicates"
          value={totals.duplicates}
        />
        <CountCard
          icon={XCircle}
          tone="danger"
          label="Failed"
          value={totals.errors}
        />
      </div>
      <ProblemRows
        title="Rows not imported"
        results={result.rows}
        mappedRows={mappedRows}
        emptyText="All rows were imported."
      />
    </div>
  )
}

// ─── Pieces ─────────────────────────────────────────────────────────

const TONES = {
  success: 'bg-emerald-soft text-emerald',
  warning: 'bg-amber-soft text-amber',
  danger: 'bg-danger-soft text-danger',
} as const

function CountCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof CheckCircle2
  tone: keyof typeof TONES
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <span className={cn('rounded-md p-2', TONES[tone])}>
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xl font-semibold tabular-nums">
          {value.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function StrategyOption({
  selected,
  disabled,
  onSelect,
  title,
  description,
}: {
  selected: boolean
  disabled: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-wait',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-primary' : 'border-muted-foreground/40',
        )}
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  )
}

function ProblemRows({
  title,
  results,
  mappedRows,
  emptyText,
}: {
  title: string
  results: PatientImportRowResult[]
  mappedRows: PatientImportRow[]
  emptyText: string
}) {
  const problems = results.filter(
    (r) => r.status === 'error' || r.status === 'duplicate',
  )
  if (!problems.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-emerald-soft p-3 text-sm text-emerald">
        <CheckCircle2 className="size-4" />
        {emptyText}
      </div>
    )
  }
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">
        {title} ({problems.length.toLocaleString()})
      </h3>
      <div className="max-h-[420px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Row</TableHead>
              <TableHead>{IMPORT_FIELD_LABEL.fullName}</TableHead>
              <TableHead>{IMPORT_FIELD_LABEL.phone}</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.slice(0, MAX_PROBLEM_ROWS).map((r) => {
              const row = mappedRows[r.index] ?? {}
              const name =
                row.fullName ||
                [row.firstName, row.lastName].filter(Boolean).join(' ')
              return (
                <TableRow
                  key={r.index}
                  className="transition-colors hover:bg-muted/40"
                >
                  <TableCell className="text-muted-foreground">
                    {r.index + 1}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {name || '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.phone || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === 'duplicate' ? 'warning' : 'danger'}
                    >
                      {r.status === 'duplicate' ? 'Duplicate' : 'Error'}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal text-xs">
                    {(r.errors ?? []).join(' · ')}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {problems.length > MAX_PROBLEM_ROWS && (
        <p className="text-xs text-muted-foreground">
          Showing the first {MAX_PROBLEM_ROWS}. The error report lists every
          row.
        </p>
      )}
    </section>
  )
}
