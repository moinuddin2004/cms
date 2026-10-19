import { DEFAULT_MAX_FILES, TEXT_MAX_LENGTH } from './form-definition.checker';
import {
  FieldDef,
  FormDefinition,
  FormIssue,
  NumberField,
  SelectField,
  TOOTH_ROLES,
  TOOTH_SURFACES,
  ToothAnswer,
  ToothChartField,
  ToothRole,
} from './form-definition.types';
import { fdiArch, fdiDentition } from './tooth-codes';

export interface FormDataResult {
  ok: boolean;
  issues: FormIssue[];
  /**
   * The answers to store: trimmed, defaulted tooth roles, hidden and empty
   * fields dropped. Only meaningful when `ok`.
   */
  value: Record<string, unknown>;
}

type Answer = unknown;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

const isEmpty = (v: Answer) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0);

/**
 * Validates one set of answers against a (checked) form definition — the
 * server-side half of lab ERD §17. Unknown keys are rejected, so a typo in
 * the client never silently loses data. Fields hidden by `visibleIf` are
 * neither required nor stored.
 */
export function validateFormData(
  def: FormDefinition,
  data: unknown,
): FormDataResult {
  const issues: FormIssue[] = [];
  const value: Record<string, unknown> = {};

  if (
    data !== undefined &&
    data !== null &&
    (typeof data !== 'object' || Array.isArray(data))
  ) {
    return {
      ok: false,
      issues: [
        {
          path: '',
          code: 'invalid_data',
          message: 'Answers must be an object',
        },
      ],
      value,
    };
  }
  const answers = (data ?? {}) as Record<string, Answer>;
  const known = new Set(def.fields.map((f) => f.key));
  for (const key of Object.keys(answers)) {
    if (!known.has(key)) {
      issues.push({
        path: key,
        code: 'unknown_field',
        message: `"${key}" is not part of this form`,
      });
    }
  }

  for (const field of def.fields) {
    if (!isVisible(field, value)) continue;
    const raw = answers[field.key];
    if (isEmpty(raw)) {
      if (field.required) {
        issues.push({
          path: field.key,
          code: 'required',
          message: `${field.label} is required`,
        });
      }
      continue;
    }
    const fail = (code: string, message: string) => {
      issues.push({
        path: field.key,
        code,
        message: `${field.label}: ${message}`,
      });
    };
    const out = check(field, raw, fail);
    if (out !== undefined) value[field.key] = out;
  }

  return { ok: issues.length === 0, issues, value };
}

/** Visibility uses the already-validated value of the (earlier) controlling field. */
function isVisible(field: FieldDef, value: Record<string, unknown>): boolean {
  if (!field.visibleIf) return true;
  const other = value[field.visibleIf.field];
  if (other === undefined) return false;
  const values = Array.isArray(other) ? other : [other];
  return field.visibleIf.in.some((v) => values.includes(v));
}

function check(
  field: FieldDef,
  raw: Answer,
  fail: (code: string, message: string) => void,
): unknown {
  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string') return fail('invalid_type', 'enter text');
      const v = raw.trim();
      const max = field.maxLength ?? TEXT_MAX_LENGTH[field.type];
      if (v.length > max) return fail('too_long', `at most ${max} characters`);
      return v;
    }
    case 'number':
      return checkNumber(field, raw, fail);
    case 'date': {
      const m = typeof raw === 'string' ? YMD.exec(raw) : null;
      const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
      if (
        !m ||
        !d ||
        d.getUTCMonth() !== +m[2] - 1 ||
        d.getUTCDate() !== +m[3]
      ) {
        return fail('invalid_date', 'use a valid date (YYYY-MM-DD)');
      }
      return raw;
    }
    case 'boolean':
      if (typeof raw !== 'boolean')
        return fail('invalid_type', 'answer yes or no');
      return raw;
    case 'select':
    case 'multi_select':
      return checkSelect(field, raw, fail);
    case 'file': {
      const max = field.maxFiles ?? DEFAULT_MAX_FILES;
      if (
        !Array.isArray(raw) ||
        !raw.every((v) => typeof v === 'string' && UUID.test(v))
      ) {
        return fail('invalid_type', 'attach uploaded files');
      }
      if (new Set(raw).size !== raw.length)
        return fail('duplicate', 'a file is attached twice');
      if (raw.length > max) return fail('too_many', `at most ${max} files`);
      return raw;
    }
    case 'tooth_chart':
      return checkTeeth(field, raw, fail);
  }
}

function checkNumber(
  field: NumberField,
  raw: Answer,
  fail: (code: string, message: string) => void,
): unknown {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fail('invalid_type', 'enter a number');
  }
  if (field.min !== undefined && raw < field.min) {
    return fail('too_small', `at least ${field.min}`);
  }
  if (field.max !== undefined && raw > field.max) {
    return fail('too_large', `at most ${field.max}`);
  }
  if (field.decimals !== undefined) {
    const factor = 10 ** field.decimals;
    if (Math.abs(Math.round(raw * factor) - raw * factor) > 1e-9) {
      return fail(
        'too_precise',
        field.decimals === 0
          ? 'use a whole number'
          : `at most ${field.decimals} decimal places`,
      );
    }
  }
  return raw;
}

function checkSelect(
  field: SelectField,
  raw: Answer,
  fail: (code: string, message: string) => void,
): unknown {
  const values = new Set(field.options.map((o) => o.value));
  if (field.type === 'select') {
    if (typeof raw !== 'string' || !values.has(raw)) {
      return fail('invalid_option', 'choose one of the options');
    }
    return raw;
  }
  if (
    !Array.isArray(raw) ||
    !raw.every((v) => typeof v === 'string' && values.has(v))
  ) {
    return fail('invalid_option', 'choose from the options');
  }
  if (new Set(raw).size !== raw.length)
    return fail('duplicate', 'an option is chosen twice');
  return raw;
}

function checkTeeth(
  field: ToothChartField,
  raw: Answer,
  fail: (code: string, message: string) => void,
): unknown {
  if (!Array.isArray(raw))
    return fail('invalid_type', 'pick teeth on the chart');
  const roles: readonly ToothRole[] = field.roles ?? TOOTH_ROLES;
  const dentition = field.dentition ?? 'any';
  const teeth: ToothAnswer[] = [];
  const seen = new Set<string>();

  for (const entry of raw as unknown[]) {
    const t = typeof entry === 'string' ? { tooth: entry } : entry;
    if (
      typeof t !== 'object' ||
      t === null ||
      typeof (t as ToothAnswer).tooth !== 'string'
    ) {
      return fail('invalid_type', 'pick teeth on the chart');
    }
    const { tooth, role, surfaces } = t as ToothAnswer &
      Record<string, unknown>;
    const kind = fdiDentition(tooth);
    if (!kind)
      return fail('invalid_tooth', `${tooth} is not an FDI tooth number`);
    if (dentition !== 'any' && kind !== dentition) {
      return fail('invalid_tooth', `${tooth} is not a ${dentition} tooth`);
    }
    if (seen.has(tooth))
      return fail('duplicate', `tooth ${tooth} is picked twice`);
    seen.add(tooth);
    if (role !== undefined && !roles.includes(role)) {
      return fail('invalid_role', `tooth ${tooth} cannot be a ${String(role)}`);
    }
    const out: ToothAnswer = { tooth, role: role ?? roles[0] };
    if (surfaces !== undefined) {
      const ok =
        field.withSurfaces &&
        Array.isArray(surfaces) &&
        surfaces.every((s) =>
          (TOOTH_SURFACES as readonly string[]).includes(s),
        ) &&
        new Set(surfaces).size === surfaces.length;
      if (!ok)
        return fail('invalid_surfaces', `invalid surfaces for tooth ${tooth}`);
      if (surfaces.length) out.surfaces = surfaces;
    }
    teeth.push(out);
  }

  if (field.minTeeth !== undefined && teeth.length < field.minTeeth) {
    return fail('too_few_teeth', `pick at least ${field.minTeeth} teeth`);
  }
  if (field.maxTeeth !== undefined && teeth.length > field.maxTeeth) {
    return fail('too_many_teeth', `pick at most ${field.maxTeeth} teeth`);
  }
  for (const [role, min] of Object.entries(field.minPerRole ?? {})) {
    const n = teeth.filter((t) => t.role === role).length;
    if (n < (min ?? 0))
      return fail('role_count', `needs at least ${min} ${role} teeth`);
  }
  if (field.sameArch && new Set(teeth.map((t) => fdiArch(t.tooth))).size > 1) {
    return fail('mixed_arches', 'all teeth must be in the same arch');
  }
  // Stable order: by FDI code, so equal answers store identically.
  return teeth.sort((a, b) => a.tooth.localeCompare(b.tooth));
}
