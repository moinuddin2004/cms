/**
 * Patient import (Excel / CSV migration) — pure helpers.
 *
 * Parsing a file into header + string rows, suggesting a column → field
 * mapping from header names (English + common Pakistani clinic headers), and
 * turning one mapped row into a `CreatePatientDto` with the same rules the
 * normal create form/API applies. Nothing here touches the database.
 */
import { Workbook } from 'exceljs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from '../dto/request/create-patient.dto';
import { Gender } from '../enums/gender.enum';
import { BloodGroup } from '../enums/blood-group.enum';
import { MaritalStatus } from '../enums/marital-status.enum';
import { PatientSource } from '../enums/patient-source.enum';

// ─── Limits ─────────────────────────────────────────────────────────

export const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Data rows (header excluded) one file may hold. */
export const IMPORT_MAX_FILE_ROWS = 5000;
/** Rows one real (non dry-run) import request may create. */
export const IMPORT_MAX_ROWS_PER_REQUEST = 1000;
/** Dry runs write nothing, so a whole file is checked in one request. */
export const IMPORT_MAX_DRY_RUN_ROWS = IMPORT_MAX_FILE_ROWS;
/** Tag added to every imported patient so the batch can be found later. */
export const IMPORT_TAG = 'imported';

// ─── Fields ─────────────────────────────────────────────────────────

export const IMPORT_FIELDS = [
  'fullName',
  'firstName',
  'lastName',
  'phone',
  'whatsappNumber',
  'cnic',
  'gender',
  'dob',
  'age',
  'email',
  'address',
  'city',
  'bloodGroup',
  'maritalStatus',
  'occupation',
  'allergies',
  'medicalHistory',
  'notes',
  'legacyNumber',
  'guardianName',
  'guardianPhone',
  'emergencyContactName',
  'emergencyContactPhone',
  'referredBy',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportRow = Partial<Record<ImportField, string | number | null>>;

export function isImportField(v: unknown): v is ImportField {
  return (IMPORT_FIELDS as readonly unknown[]).includes(v);
}

/**
 * Header synonyms per field, already in `normalizeHeader` form. Exact matches
 * win over "header contains synonym" matches; a longer synonym beats a
 * shorter one, so "emergency contact no" goes to the emergency phone and not
 * to `phone` (via "contact no").
 */
const SYNONYMS: Record<ImportField, string[]> = {
  fullName: [
    'name',
    'full name',
    'patient name',
    'patients name',
    'patient',
    'naam',
    'patient naam',
    'mareez',
    'mareez ka naam',
    'mariz',
    'client name',
    'name of patient',
    'patient full name',
  ],
  firstName: ['first name', 'fname', 'given name', 'first'],
  lastName: ['last name', 'lname', 'surname', 'family name', 'last'],
  phone: [
    'phone',
    'phone no',
    'phone number',
    'mobile',
    'mobile no',
    'mobile number',
    'mob',
    'mob no',
    'contact',
    'contact no',
    'contact number',
    'cell',
    'cell no',
    'cell number',
    'tel',
    'telephone',
    'ph',
    'ph no',
    'fone',
    'number',
    'phone mobile',
    'mobile phone',
    'contact mobile',
  ],
  whatsappNumber: [
    'whatsapp',
    'whatsapp no',
    'whatsapp number',
    'wa number',
    'whats app',
  ],
  cnic: [
    'cnic',
    'nic',
    'cnic no',
    'cnic number',
    'nic no',
    'id card',
    'id card no',
    'national id',
    'shanakhti card',
    'b form',
    'bform',
    'nicop',
  ],
  gender: ['gender', 'sex', 'jins', 'm f', 'male female'],
  dob: [
    'dob',
    'd o b',
    'date of birth',
    'birth date',
    'birthdate',
    'birthday',
    'tareekh paidaish',
    'tarikh paidaish',
    'date birth',
  ],
  age: ['age', 'umar', 'umr', 'age years', 'age yrs', 'age in years', 'age y'],
  email: ['email', 'e mail', 'email address', 'mail', 'email id'],
  address: [
    'address',
    'home address',
    'residential address',
    'addr',
    'pata',
    'patient address',
  ],
  city: ['city', 'shehar', 'shehr', 'town'],
  bloodGroup: ['blood group', 'blood type', 'bg', 'blood', 'b group'],
  maritalStatus: ['marital status', 'married', 'shadi', 'marital'],
  occupation: ['occupation', 'profession', 'job', 'pesha', 'work'],
  allergies: [
    'allergies',
    'allergy',
    'allergic to',
    'drug allergy',
    'drug allergies',
  ],
  medicalHistory: [
    'medical history',
    'history',
    'past history',
    'past medical history',
    'disease',
    'diseases',
    'medical conditions',
    'conditions',
    'bemari',
    'bimari',
    'diagnosis',
    'chief complaint',
  ],
  notes: [
    'notes',
    'note',
    'remarks',
    'remark',
    'comments',
    'comment',
    'description',
    'details',
  ],
  legacyNumber: [
    'old file no',
    'old file number',
    'file no',
    'file number',
    'file',
    'mr no',
    'mrn',
    'mr number',
    'mr',
    'medical record number',
    'medical record no',
    'patient id',
    'patient no',
    'patient number',
    'patient code',
    'reg no',
    'registration no',
    'registration number',
    'old id',
    'old no',
    'card no',
    'opd no',
    'id',
  ],
  guardianName: ['guardian', 'guardian name', 'parent name', 'parent'],
  guardianPhone: [
    'guardian phone',
    'guardian contact',
    'guardian mobile',
    'parent phone',
  ],
  emergencyContactName: [
    'emergency contact',
    'emergency contact name',
    'emergency name',
  ],
  emergencyContactPhone: [
    'emergency phone',
    'emergency contact no',
    'emergency contact number',
    'emergency number',
    'emergency mobile',
    'emergency contact phone',
  ],
  referredBy: [
    'referred by',
    'reference',
    'ref by',
    'referral',
    'referred from',
    'refered by',
  ],
};

/** Lowercase, punctuation → spaces, `#`/`no.` style suffixes kept as words. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/#/g, ' no ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Suggested field per header (each field used at most once). */
export function suggestMapping(
  headers: string[],
): Record<string, ImportField | null> {
  const result: Record<string, ImportField | null> = {};
  const used = new Set<ImportField>();
  const norm = headers.map(normalizeHeader);
  headers.forEach((h) => (result[h] = null));

  // Pass 1: exact synonym matches.
  headers.forEach((h, i) => {
    for (const field of IMPORT_FIELDS) {
      if (used.has(field)) continue;
      if (SYNONYMS[field].includes(norm[i])) {
        result[h] = field;
        used.add(field);
        return;
      }
    }
  });

  // Pass 2: header contains a synonym as whole words — longest synonym wins.
  headers.forEach((h, i) => {
    if (result[h] || !norm[i]) return;
    const padded = ` ${norm[i]} `;
    let best: { field: ImportField; len: number } | null = null;
    for (const field of IMPORT_FIELDS) {
      if (used.has(field)) continue;
      for (const syn of SYNONYMS[field]) {
        if (syn.length < 3) continue; // "id", "mr", "bg" only as exact headers
        if (padded.includes(` ${syn} `) && (!best || syn.length > best.len)) {
          best = { field, len: syn.length };
        }
      }
    }
    if (best) {
      result[h] = best.field;
      used.add(best.field);
    }
  });

  return result;
}

// ─── File parsing ───────────────────────────────────────────────────

export interface ParsedImport {
  headers: string[];
  rows: Record<string, string>[];
  suggestedMapping: Record<string, ImportField | null>;
}

export class ImportFileError extends Error {}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** One exceljs cell value as a trimmed string; dates as yyyy-mm-dd. */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    // exceljs gives the sheet's calendar date at UTC midnight.
    return isoDate(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    // Large integers (phones, CNICs) without exponent notation.
    return Number.isInteger(value) ? value.toFixed(0) : String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[])
        .map((r) => r.text ?? '')
        .join('')
        .trim();
    }
    if ('result' in v) return cellToString(v.result); // formula
    if ('text' in v) return cellToString(v.text); // hyperlink
    return '';
  }
  return typeof value === 'bigint' ? value.toString() : '';
}

/** RFC-4180 CSV (quotes, escaped quotes, CRLF, embedded newlines). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delimiter =
    count('\t') > count(',') && count('\t') >= count(';')
      ? '\t'
      : count(';') > count(',')
        ? ';'
        : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * A cell matrix → headers + keyed rows. The first non-empty row is the header;
 * blank headers become "Column N", repeated headers get " (2)", " (3)"….
 * Fully empty rows are dropped.
 */
export function buildSheet(
  matrix: string[][],
  maxRows = IMPORT_MAX_FILE_ROWS,
): { headers: string[]; rows: Record<string, string>[] } {
  const cleaned = matrix.map((r) => r.map((c) => (c ?? '').trim()));
  const headerIdx = cleaned.findIndex((r) => r.some((c) => c !== ''));
  if (headerIdx < 0) throw new ImportFileError('The file is empty');

  const raw = cleaned[headerIdx];
  // Drop trailing blank header cells unless data sits under them.
  let width = raw.length;
  const dataWidth = Math.max(
    0,
    ...cleaned.slice(headerIdx + 1).map((r) => {
      let w = r.length;
      while (w > 0 && r[w - 1] === '') w--;
      return w;
    }),
  );
  while (width > dataWidth && width > 0 && raw[width - 1] === '') width--;
  width = Math.max(width, dataWidth);

  const seen = new Map<string, number>();
  const headers: string[] = [];
  for (let i = 0; i < width; i++) {
    let name = raw[i] || `Column ${i + 1}`;
    const key = name.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) name = `${name} (${n})`;
    headers.push(name);
  }

  const rows: Record<string, string>[] = [];
  for (const r of cleaned.slice(headerIdx + 1)) {
    if (!r.some((c) => c !== '')) continue;
    if (rows.length >= maxRows) {
      throw new ImportFileError(
        `The file has more than ${maxRows.toLocaleString('en-US')} patient rows. Split it into smaller files.`,
      );
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = r[i] ?? ''));
    rows.push(obj);
  }
  if (!rows.length) throw new ImportFileError('The file has no patient rows');
  return { headers, rows };
}

export type ImportFileKind = 'xlsx' | 'csv';

/** File kind from its name (and magic bytes for xlsx); null = unsupported. */
export function importFileKind(
  filename: string,
  buffer: Buffer,
): ImportFileKind | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv' || ext === 'txt') return 'csv';
  if (ext === 'xlsx') {
    // xlsx is a zip: "PK\x03\x04".
    return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
      ? 'xlsx'
      : null;
  }
  return null;
}

/** Parses the first worksheet of an .xlsx or a .csv file. Stores nothing. */
export async function parseImportFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedImport> {
  const kind = importFileKind(filename, buffer);
  if (!kind) {
    throw new ImportFileError(
      'Unsupported file. Upload an Excel (.xlsx) or CSV file — for old .xls files use "Save as" .xlsx first.',
    );
  }

  let matrix: string[][];
  if (kind === 'csv') {
    matrix = parseCsv(buffer.toString('utf8'));
  } else {
    const wb = new Workbook();
    try {
      // exceljs' typings predate Node's generic Buffer.
      await wb.xlsx.load(
        buffer as unknown as Parameters<typeof wb.xlsx.load>[0],
      );
    } catch {
      throw new ImportFileError(
        'Could not read the Excel file. Is it a valid .xlsx?',
      );
    }
    const ws =
      wb.worksheets.find((s) => s.actualRowCount > 0) ?? wb.worksheets[0];
    if (!ws) throw new ImportFileError('The workbook has no sheets');
    if (ws.actualRowCount > IMPORT_MAX_FILE_ROWS + 50) {
      throw new ImportFileError(
        `The file has more than ${IMPORT_MAX_FILE_ROWS.toLocaleString('en-US')} patient rows. Split it into smaller files.`,
      );
    }
    matrix = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = cellToString(cell.value);
      });
      matrix[rowNumber - 1] = Array.from(cells, (c) => c ?? '');
    });
    matrix = Array.from(matrix, (r) => r ?? []);
  }

  const { headers, rows } = buildSheet(matrix);
  return { headers, rows, suggestedMapping: suggestMapping(headers) };
}

// ─── Value normalisers ──────────────────────────────────────────────

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
const CNIC_RE = /^\d{5}-\d{7}-\d$/;

function str(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return (typeof v === 'number' ? cellToString(v) : String(v))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits "0300-1234567 / 0321-7654321" into the numbers it holds and cleans
 * each for storage: spreadsheet artefacts ("…567.0", leading apostrophe)
 * removed, a leading zero restored when Excel dropped it (3001234567).
 */
export function splitPhones(raw: string | number | null | undefined): string[] {
  const text = str(raw).replace(/^'/, '');
  if (!text) return [];
  return text
    .split(/[/,;|]|\bor\b/i)
    .flatMap((part) => {
      // "0300-1234567 0321-7654321": two numbers separated by a space.
      const pieces = part.trim().split(' ');
      const digits = part.replace(/\D/g, '').length;
      return digits > 13 &&
        pieces.length > 1 &&
        pieces.every((x) => x.replace(/\D/g, '').length >= 7)
        ? pieces
        : [part];
    })
    .map((p) =>
      p
        .replace(/\.0+$/, '')
        .replace(/[^0-9+\-\s()]/g, '')
        .trim(),
    )
    .map((p) => (/^3\d{9}$/.test(p) ? `0${p}` : p))
    .filter((p) => p.replace(/\D/g, '').length > 0);
}

/** Phone comparison key: digits only, +92 / 0092 / 92 folded into a leading 0. */
export function phoneKey(phone: string | null | undefined): string {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.startsWith('0092')) d = `0${d.slice(4)}`;
  else if (d.startsWith('92') && d.length === 12) d = `0${d.slice(2)}`;
  else if (/^3\d{9}$/.test(d)) d = `0${d}`;
  return d;
}

/** 13 digits → 12345-1234567-1; '' when empty; null when not a CNIC. */
export function normalizeCnic(
  raw: string | number | null | undefined,
): string | null {
  const text = str(raw);
  if (!text) return '';
  const d = text.replace(/\D/g, '');
  if (d.length !== 13) return null;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function cnicKey(cnic: string | null | undefined): string {
  return (cnic ?? '').replace(/\D/g, '');
}

const GENDER_WORDS: Record<string, Gender> = {
  m: Gender.MALE,
  male: Gender.MALE,
  man: Gender.MALE,
  boy: Gender.MALE,
  mr: Gender.MALE,
  mard: Gender.MALE,
  larka: Gender.MALE,
  ladka: Gender.MALE,
  f: Gender.FEMALE,
  female: Gender.FEMALE,
  woman: Gender.FEMALE,
  girl: Gender.FEMALE,
  mrs: Gender.FEMALE,
  ms: Gender.FEMALE,
  miss: Gender.FEMALE,
  aurat: Gender.FEMALE,
  larki: Gender.FEMALE,
  ladki: Gender.FEMALE,
  khatoon: Gender.FEMALE,
  o: Gender.OTHER,
  other: Gender.OTHER,
  transgender: Gender.OTHER,
};

/** undefined = blank, null = not recognised. */
export function parseGender(
  raw: string | number | null | undefined,
): Gender | undefined | null {
  const text = str(raw)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!text) return undefined;
  return GENDER_WORDS[text] ?? null;
}

/** "A+ve", "b positive", "AB -", "o neg" → enum. undefined = blank, null = unknown. */
export function parseBloodGroup(
  raw: string | number | null | undefined,
): BloodGroup | undefined | null {
  let text = str(raw).toUpperCase().replace(/\s+/g, '');
  if (!text) return undefined;
  text = text
    .replace(/POSITIVE|POS|\+VE|VE\+|\(\+\)/g, '+')
    .replace(/NEGATIVE|NEG|-VE|VE-|\(-\)/g, '-')
    .replace(/[–—]/g, '-');
  return (Object.values(BloodGroup) as string[]).includes(text)
    ? (text as BloodGroup)
    : null;
}

export function parseMaritalStatus(
  raw: string | number | null | undefined,
): MaritalStatus | undefined | null {
  if (!str(raw)) return undefined;
  const text = str(raw)
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();
  if (/^(single|unmarried|kunwara|kunwari|not married|s)$/.test(text))
    return MaritalStatus.SINGLE;
  if (/^(married|shadi shuda|shadishuda|m)$/.test(text))
    return MaritalStatus.MARRIED;
  if (/^(divorced|talaq|talaq yafta)$/.test(text))
    return MaritalStatus.DIVORCED;
  if (/^(widow|widowed|widower|bewa|d)$/.test(text))
    return MaritalStatus.WIDOWED;
  return null;
}

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

function validYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  return isoDate(y, m, d);
}

function fullYear(y: number, today: Date): number {
  if (y >= 100) return y;
  const yy = today.getFullYear() % 100;
  return y <= yy ? 2000 + y : 1900 + y;
}

/**
 * A date as yyyy-mm-dd, or null. Accepts ISO, day-first d/m/y (d-m-y, d.m.y —
 * month-first only when the day part cannot be a month), "12 Jan 1990",
 * "Jan 12, 1990" and Excel serial numbers.
 */
export function parseDate(
  raw: string | number | null | undefined,
  today: Date = new Date(),
): string | null {
  const text = str(raw);
  if (!text) return null;

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(text);
  if (m) return validYmd(+m[1], +m[2], +m[3]);

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = fullYear(+m[3], today);
    // Day-first (Pakistan/UK); fall back to month-first when it cannot be.
    return validYmd(y, b, a) ?? (b > 12 ? validYmd(y, a, b) : null);
  }

  m = /^(\d{1,2})[\s\-/.]+([a-z]{3,})[\s\-/.,]+(\d{2}|\d{4})$/i.exec(text);
  if (m) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return mon < 0 ? null : validYmd(fullYear(+m[3], today), mon + 1, +m[1]);
  }

  m =
    /^([a-z]{3,})[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?[\s,\-/.]+(\d{2}|\d{4})$/i.exec(
      text,
    );
  if (m) {
    const mon = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return mon < 0 ? null : validYmd(fullYear(+m[3], today), mon + 1, +m[2]);
  }

  // A bare year → 1 Jan of that year.
  m = /^(\d{4})$/.exec(text);
  if (m && +m[1] >= 1900 && +m[1] <= today.getFullYear()) {
    return isoDate(+m[1], 1, 1);
  }

  // Excel serial date (1900 system, with its leap-year bug): 5 digits.
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial < 80000) {
      const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return isoDate(
        dt.getUTCFullYear(),
        dt.getUTCMonth() + 1,
        dt.getUTCDate(),
      );
    }
  }
  return null;
}

/**
 * An age as whole months from "35", "35 years", "35y", "35 saal", "6 months",
 * "2.5" (years). null when it is not an age.
 */
export function parseAge(
  raw: string | number | null | undefined,
): number | null {
  const text = str(raw).toLowerCase();
  if (!text) return null;
  const m =
    /^(\d{1,3}(?:\.\d+)?)\s*(y|yr|yrs|year|years|saal|sal|m|mo|mon|month|months|mahina|mahine)?\.?$/.exec(
      text,
    );
  if (!m) return null;
  const n = Number(m[1]);
  const inMonths = /^(m|mo|mon|month|months|mahina|mahine)$/.test(m[2] ?? '');
  if (inMonths) return n > 36 ? null : Math.round(n);
  return n > 130 ? null : Math.round(n * 12);
}

// ─── Row mapping + validation ───────────────────────────────────────

export interface MappedRow {
  /** The CreatePatientDto payload (plain object). */
  dto: Record<string, unknown>;
  errors: string[];
  /** DTO properties already covered by an entry in `errors`. */
  flagged: string[];
}

/**
 * One mapped import row → CreatePatientDto payload plus the problems found
 * while converting. `today` is injectable for tests.
 */
export function mapImportRow(
  row: ImportRow,
  today: Date = new Date(),
): MappedRow {
  const errors: string[] = [];
  const dto: Record<string, unknown> = {};
  const notes: string[] = [];
  const flagged: string[] = [];
  const v = (f: ImportField) => str(row[f]);

  // Name
  let fullName = v('fullName');
  if (!fullName)
    fullName = [v('firstName'), v('lastName')].filter(Boolean).join(' ');
  dto.fullName = fullName;

  // Phones — the first number is the patient's phone, extras go to notes.
  const phones = splitPhones(row.phone);
  dto.phone = phones[0] ?? '';
  if (phones.length > 1)
    notes.push(`Other phone: ${phones.slice(1).join(', ')}`);
  if (v('phone') && (!phones.length || !PHONE_RE.test(phones[0]))) {
    errors.push(`Phone number "${v('phone')}" looks invalid (7–20 digits)`);
    flagged.push('phone');
  }
  const optionalPhone = (field: ImportField, key: string, label: string) => {
    if (!v(field)) return;
    const list = splitPhones(row[field]);
    if (!list.length || !PHONE_RE.test(list[0])) {
      errors.push(`${label} "${v(field)}" looks invalid`);
      flagged.push(key);
    }
    if (list.length) dto[key] = list[0];
  };
  optionalPhone('whatsappNumber', 'whatsappNumber', 'WhatsApp number');
  optionalPhone('guardianPhone', 'guardianPhone', 'Guardian phone');
  optionalPhone(
    'emergencyContactPhone',
    'emergencyContactPhone',
    'Emergency contact phone',
  );

  // CNIC
  const cnic = normalizeCnic(row.cnic);
  if (cnic === null)
    errors.push(
      `CNIC "${v('cnic')}" must have 13 digits (e.g. 42101-1234567-1)`,
    );
  else if (cnic && CNIC_RE.test(cnic)) dto.cnic = cnic;

  // Gender / blood group / marital status
  const gender = parseGender(row.gender);
  if (gender === null)
    errors.push(`Gender "${v('gender')}" must be male, female or other`);
  else if (gender) dto.gender = gender;

  const blood = parseBloodGroup(row.bloodGroup);
  if (blood === null)
    errors.push(
      `Blood group "${v('bloodGroup')}" is not recognised (e.g. A+, O-)`,
    );
  else if (blood) dto.bloodGroup = blood;

  const marital = parseMaritalStatus(row.maritalStatus);
  if (marital === null)
    errors.push(`Marital status "${v('maritalStatus')}" is not recognised`);
  else if (marital) dto.maritalStatus = marital;

  // Date of birth — a real date wins; an age (or an age typed in the DOB
  // column) becomes 1 Jan of the birth year.
  const dobText = v('dob');
  let dob: string | null = null;
  let ageText = v('age');
  if (dobText) {
    dob = parseDate(dobText, today);
    if (!dob) {
      if (parseAge(dobText) !== null) ageText = ageText || dobText;
      else
        errors.push(
          `Date of birth "${dobText}" is not a date (use dd/mm/yyyy)`,
        );
    }
  }
  if (!dob && ageText) {
    const months = parseAge(ageText);
    if (months === null) {
      errors.push(`Age "${ageText}" is not a number of years`);
    } else {
      const birthYear = new Date(
        today.getFullYear(),
        today.getMonth() - months,
        1,
      ).getFullYear();
      dob = isoDate(birthYear, 1, 1);
      notes.push(`Date of birth estimated from age ${ageText}`);
    }
  }
  if (dob) {
    const todayIso = isoDate(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate(),
    );
    if (dob > todayIso) errors.push('Date of birth cannot be in the future');
    else if (dob < '1900-01-01') errors.push('Date of birth is before 1900');
    else dto.dob = dob;
  }

  // Plain text fields
  const email = v('email').toLowerCase();
  if (email) dto.email = email;
  const text: [ImportField, string][] = [
    ['address', 'address'],
    ['city', 'city'],
    ['occupation', 'occupation'],
    ['allergies', 'allergies'],
    ['medicalHistory', 'medicalHistory'],
    ['guardianName', 'guardianName'],
    ['emergencyContactName', 'emergencyContactName'],
    ['referredBy', 'referredByText'],
  ];
  for (const [field, key] of text) {
    const value = v(field);
    if (value) dto[key] = value;
  }

  // Notes: the file's notes, the old file / MR number (the patient record has
  // no legacy-number column), and anything the import had to infer.
  const legacy = v('legacyNumber');
  const allNotes = [
    v('notes'),
    legacy ? `Old file no: ${legacy}` : '',
    ...notes,
  ].filter(Boolean);
  if (allNotes.length) dto.internalNotes = allNotes.join('\n');

  dto.source = dto.referredByText
    ? PatientSource.REFERRAL
    : PatientSource.OTHER;
  dto.tags = [IMPORT_TAG];
  return { dto, errors, flagged };
}

const DTO_LABELS: Record<string, string> = {
  fullName: 'Full name',
  phone: 'Phone',
  whatsappNumber: 'WhatsApp number',
  cnic: 'CNIC',
  email: 'Email',
  city: 'City',
  occupation: 'Occupation',
  guardianName: 'Guardian name',
  guardianPhone: 'Guardian phone',
  emergencyContactName: 'Emergency contact name',
  emergencyContactPhone: 'Emergency contact phone',
  referredByText: 'Referred by',
};

/**
 * class-validator problems for a CreatePatientDto payload, keyed by property,
 * with "fullName must be shorter…" reworded to "Full name must be shorter…".
 */
export async function createDtoErrors(
  dto: Record<string, unknown>,
): Promise<{ property: string; message: string }[]> {
  const instance = plainToInstance(CreatePatientDto, dto);
  const issues = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return issues.flatMap((i) =>
    Object.values(i.constraints ?? {}).map((message) => ({
      property: i.property,
      message: message.startsWith(`${i.property} `)
        ? `${DTO_LABELS[i.property] ?? i.property}${message.slice(i.property.length)}`
        : message,
    })),
  );
}

/** mapImportRow + the create DTO's own validation (same rules as a normal create). */
export async function validateImportRow(
  row: ImportRow,
  today: Date = new Date(),
): Promise<MappedRow> {
  const mapped = mapImportRow(row, today);
  const errors = [...mapped.errors];
  for (const issue of await createDtoErrors(mapped.dto)) {
    // A property we already explained in our own words is not repeated.
    if (mapped.flagged.includes(issue.property)) continue;
    if (!errors.includes(issue.message)) errors.push(issue.message);
  }
  return { ...mapped, errors };
}

// ─── Duplicates ─────────────────────────────────────────────────────

export interface DuplicateIndex {
  /** phoneKey → label of the patient / row that has it. */
  phones: Map<string, string>;
  /** cnicKey → label. */
  cnics: Map<string, string>;
}

export function emptyDuplicateIndex(): DuplicateIndex {
  return { phones: new Map(), cnics: new Map() };
}

export function addToDuplicateIndex(
  index: DuplicateIndex,
  phone: string | null | undefined,
  cnic: string | null | undefined,
  label: string,
): void {
  const p = phoneKey(phone);
  const c = cnicKey(cnic);
  if (p && !index.phones.has(p)) index.phones.set(p, label);
  if (c && !index.cnics.has(c)) index.cnics.set(c, label);
}

/** Which existing patient / earlier row this payload duplicates, if any. */
export function findDuplicate(
  index: DuplicateIndex,
  phone: string | null | undefined,
  cnic: string | null | undefined,
): { by: 'phone' | 'cnic'; label: string } | null {
  const p = phoneKey(phone);
  if (p && index.phones.has(p))
    return { by: 'phone', label: index.phones.get(p)! };
  const c = cnicKey(cnic);
  if (c && index.cnics.has(c))
    return { by: 'cnic', label: index.cnics.get(c)! };
  return null;
}
