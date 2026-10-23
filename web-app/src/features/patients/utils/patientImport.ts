import type {
  PatientImportField,
  PatientImportRow,
  PatientImportRowResult,
} from '../types'

/** Rows per real import request (the API accepts up to 1000). */
export const IMPORT_BATCH_SIZE = 500
export const IMPORT_MAX_FILE_MB = 10
export const IMPORT_ACCEPT =
  '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Select value meaning "don't import this column". */
export const IGNORE_COLUMN = 'none'

export interface ImportFieldDef {
  key: PatientImportField
  label: string
  hint?: string
}

/** Fields offered in the column mapping, in display order. */
export const IMPORT_FIELD_DEFS: ImportFieldDef[] = [
  { key: 'fullName', label: 'Full name' },
  {
    key: 'firstName',
    label: 'First name',
    hint: 'Joined with last name when there is no full name',
  },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'whatsappNumber', label: 'WhatsApp number' },
  { key: 'cnic', label: 'CNIC' },
  { key: 'gender', label: 'Gender' },
  {
    key: 'dob',
    label: 'Date of birth',
    hint: 'dd/mm/yyyy, yyyy-mm-dd or an Excel date',
  },
  { key: 'age', label: 'Age', hint: 'Stored as 1 Jan of the birth year' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'bloodGroup', label: 'Blood group' },
  { key: 'maritalStatus', label: 'Marital status' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'medicalHistory', label: 'Medical history' },
  { key: 'notes', label: 'Notes', hint: 'Saved as internal notes' },
  {
    key: 'legacyNumber',
    label: 'Old file / MR no.',
    hint: 'Saved in internal notes',
  },
  { key: 'guardianName', label: 'Guardian name' },
  { key: 'guardianPhone', label: 'Guardian phone' },
  { key: 'emergencyContactName', label: 'Emergency contact name' },
  { key: 'emergencyContactPhone', label: 'Emergency contact phone' },
  { key: 'referredBy', label: 'Referred by' },
]

export const IMPORT_FIELD_LABEL = Object.fromEntries(
  IMPORT_FIELD_DEFS.map((f) => [f.key, f.label]),
) as Record<PatientImportField, string>

/** header → field, or IGNORE_COLUMN. */
export type ColumnMapping = Record<
  string,
  PatientImportField | typeof IGNORE_COLUMN
>

/** What is still missing for the mapping to be importable. */
export function missingRequired(mapping: ColumnMapping): string[] {
  const used = new Set(Object.values(mapping))
  const missing: string[] = []
  if (!used.has('fullName') && !used.has('firstName')) missing.push('Full name')
  if (!used.has('phone')) missing.push('Phone')
  return missing
}

/** One file row → the patient fields its mapped columns hold. */
export function applyMapping(
  row: Record<string, string>,
  mapping: ColumnMapping,
): PatientImportRow {
  const out: PatientImportRow = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (field === IGNORE_COLUMN) continue
    const value = (row[header] ?? '').trim()
    if (value) out[field] = value
  }
  return out
}

/** One CSV cell, quoted when needed, formulas neutralised. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  const plainNumber = /^[+-][\d\s().-]+$/.test(text)
  if (/^[=+\-@\t\r]/.test(text) && !plainNumber) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** Saves text as a file in the browser (UTF-8 BOM so Excel reads Urdu). */
export function downloadCsv(name: string, csv: string) {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Headers of the sample template (all recognised by the auto-mapping). */
export const SAMPLE_TEMPLATE_HEADERS = [
  'Full Name',
  'Phone',
  'CNIC',
  'Gender',
  'Date of Birth',
  'Age',
  'Email',
  'Address',
  'City',
  'Blood Group',
  'Allergies',
  'Medical History',
  'Notes',
  'Old File No',
]

export function downloadSampleTemplate() {
  downloadCsv('patient-import-template.csv', toCsv([SAMPLE_TEMPLATE_HEADERS]))
}

/** Rows that were not imported, with the file's own columns + the reason. */
export function downloadErrorReport(
  headers: string[],
  fileRows: Record<string, string>[],
  results: PatientImportRowResult[],
) {
  const failed = results.filter(
    (r) => r.status === 'error' || r.status === 'duplicate',
  )
  const rows: unknown[][] = [['Row', ...headers, 'Status', 'Reason']]
  for (const r of failed) {
    const src = fileRows[r.index] ?? {}
    rows.push([
      r.index + 1,
      ...headers.map((h) => src[h] ?? ''),
      r.status === 'duplicate' ? 'Duplicate' : 'Error',
      (r.errors ?? []).join('; '),
    ])
  }
  const day = new Date().toISOString().slice(0, 10)
  downloadCsv(`patient-import-errors-${day}.csv`, toCsv(rows))
}
