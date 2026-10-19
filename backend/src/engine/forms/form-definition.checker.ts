import {
  FIELD_TYPES,
  FieldDef,
  FieldOption,
  FieldType,
  FormDefinition,
  FormIssue,
  FormUi,
  Promotions,
  TOOTH_ROLES,
  ToothRole,
} from './form-definition.types';
import { PROMOTION_TARGETS } from './promotion-targets';

export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,49}$/;
export const MAX_FIELDS = 100;
export const MAX_OPTIONS = 200;
export const TEXT_MAX_LENGTH = { text: 500, textarea: 5000 } as const;
export const DEFAULT_MAX_FILES = 10;

const COMMON_PROPS = ['key', 'type', 'label', 'help', 'required', 'visibleIf'];
const PROPS_BY_TYPE: Record<FieldType, string[]> = {
  tooth_chart: [
    'numbering',
    'roles',
    'minTeeth',
    'maxTeeth',
    'minPerRole',
    'sameArch',
    'dentition',
    'withSurfaces',
  ],
  select: ['options', 'defaultValue'],
  multi_select: ['options', 'defaultValue'],
  text: ['maxLength', 'defaultValue'],
  textarea: ['maxLength', 'defaultValue'],
  number: ['min', 'max', 'decimals', 'unit', 'defaultValue'],
  date: [],
  boolean: ['defaultValue'],
  file: ['maxFiles', 'accept'],
};
/** Field types another field's `visibleIf` may depend on. */
const CONDITION_TYPES: FieldType[] = ['select', 'multi_select', 'boolean'];

export interface DefinitionCheck {
  /** Blocking problems. Empty = publishable. */
  issues: FormIssue[];
  /** Normalised definition (string options expanded) when structurally readable. */
  definition: FormDefinition | null;
  ui: FormUi | null;
  promotions: Promotions;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/**
 * Checks a form schema version before it may be published (lab ERD §18):
 * valid JSON shape, unique keys, known types and properties, consistent
 * options/limits, conditions that point backwards (so no cycles), a layout
 * that only names real fields, and promotions to registered typed columns.
 */
export function checkDefinition(
  schemaJson: unknown,
  uiJson: unknown,
  promotionsJson: unknown,
): DefinitionCheck {
  const issues: FormIssue[] = [];
  const issue = (path: string, code: string, message: string) =>
    issues.push({ path, code, message });

  if (!isObj(schemaJson) || !Array.isArray(schemaJson.fields)) {
    issue('fields', 'invalid_schema', 'The schema needs a "fields" array');
    return { issues, definition: null, ui: null, promotions: {} };
  }
  const raw = schemaJson.fields;
  if (raw.length === 0) issue('fields', 'no_fields', 'Add at least one field');
  if (raw.length > MAX_FIELDS) {
    issue('fields', 'too_many_fields', `At most ${MAX_FIELDS} fields`);
  }

  const fields: FieldDef[] = [];
  const seen = new Map<string, FieldDef>();
  let toothCharts = 0;

  raw.forEach((rawField, i) => {
    const at = `fields[${i}]`;
    if (!isObj(rawField)) {
      issue(at, 'invalid_field', 'Each field must be an object');
      return;
    }
    const f = rawField;
    const key = f.key;
    if (!isStr(key) || !KEY_PATTERN.test(key)) {
      issue(
        `${at}.key`,
        'invalid_key',
        'Keys are lowercase letters, digits and _ (start with a letter, max 50)',
      );
      return;
    }
    const p = (prop: string) => `${key}.${prop}`;
    if (seen.has(key)) {
      issue(p('key'), 'duplicate_key', `Field key "${key}" is used twice`);
      return;
    }
    if (!FIELD_TYPES.includes(f.type as FieldType)) {
      issue(
        p('type'),
        'unknown_type',
        `Unknown field type "${String(f.type)}"`,
      );
      return;
    }
    const type = f.type as FieldType;

    const allowed = new Set([...COMMON_PROPS, ...PROPS_BY_TYPE[type]]);
    for (const prop of Object.keys(f)) {
      if (!allowed.has(prop)) {
        issue(
          p(prop),
          'unknown_property',
          `"${prop}" is not a ${type} setting`,
        );
      }
    }
    if (!isStr(f.label) || !f.label.trim() || f.label.length > 150) {
      issue(p('label'), 'invalid_label', 'Every field needs a label (max 150)');
    }
    if (f.help !== undefined && (!isStr(f.help) || f.help.length > 500)) {
      issue(p('help'), 'invalid_help', 'Help text is at most 500 characters');
    }
    if (f.required !== undefined && typeof f.required !== 'boolean') {
      issue(p('required'), 'invalid_required', '"required" is true or false');
    }

    if (f.visibleIf !== undefined) {
      const cond = f.visibleIf;
      const target =
        isObj(cond) && isStr(cond.field) ? seen.get(cond.field) : undefined;
      if (!isObj(cond) || !target) {
        issue(
          p('visibleIf'),
          'invalid_condition',
          'visibleIf must name a field that comes earlier in the form',
        );
      } else if (!CONDITION_TYPES.includes(target.type)) {
        issue(
          p('visibleIf'),
          'invalid_condition',
          'visibleIf can depend on select, multi-select or yes/no fields only',
        );
      } else if (
        !Array.isArray(cond.in) ||
        !cond.in.length ||
        !cond.in.every((v) => isStr(v) || typeof v === 'boolean')
      ) {
        issue(
          p('visibleIf'),
          'invalid_condition',
          'visibleIf.in lists the values that show this field',
        );
      } else if (target.type !== 'boolean') {
        const values = new Set(
          (target as { options: FieldOption[] }).options.map((o) => o.value),
        );
        const bad = cond.in.filter((v) => !values.has(String(v)));
        if (bad.length) {
          issue(
            p('visibleIf'),
            'invalid_condition',
            `"${target.key}" has no option ${bad.join(', ')}`,
          );
        }
      }
    }

    const field = { ...f } as unknown as FieldDef;
    switch (type) {
      case 'select':
      case 'multi_select': {
        const options = normaliseOptions(f.options);
        if (!options) {
          issue(
            p('options'),
            'invalid_options',
            'Options are a list of values (or {value, label})',
          );
          break;
        }
        if (!options.length || options.length > MAX_OPTIONS) {
          issue(
            p('options'),
            'invalid_options',
            `Give 1–${MAX_OPTIONS} options`,
          );
        }
        const values = options.map((o) => o.value);
        if (new Set(values).size !== values.length) {
          issue(
            p('options'),
            'duplicate_option',
            'Option values must be unique',
          );
        }
        (field as { options: FieldOption[] }).options = options;
        const d = f.defaultValue;
        if (d !== undefined) {
          const list = type === 'multi_select' && Array.isArray(d) ? d : [d];
          if (
            (type === 'select' && Array.isArray(d)) ||
            !list.every((v) => isStr(v) && values.includes(v))
          ) {
            issue(
              p('defaultValue'),
              'invalid_default',
              'The default must be one of the options',
            );
          }
        }
        break;
      }
      case 'text':
      case 'textarea': {
        const cap = TEXT_MAX_LENGTH[type];
        if (
          f.maxLength !== undefined &&
          (!isInt(f.maxLength) || f.maxLength < 1 || f.maxLength > cap)
        ) {
          issue(p('maxLength'), 'invalid_limit', `maxLength is 1–${cap}`);
        }
        const max = isInt(f.maxLength) ? f.maxLength : cap;
        if (
          f.defaultValue !== undefined &&
          (!isStr(f.defaultValue) || f.defaultValue.length > max)
        ) {
          issue(
            p('defaultValue'),
            'invalid_default',
            'The default must be text within maxLength',
          );
        }
        break;
      }
      case 'number': {
        for (const prop of ['min', 'max'] as const) {
          if (f[prop] !== undefined && !Number.isFinite(f[prop])) {
            issue(p(prop), 'invalid_limit', `${prop} must be a number`);
          }
        }
        if (
          Number.isFinite(f.min) &&
          Number.isFinite(f.max) &&
          (f.min as number) > (f.max as number)
        ) {
          issue(p('min'), 'invalid_limit', 'min is larger than max');
        }
        if (
          f.decimals !== undefined &&
          (!isInt(f.decimals) || f.decimals < 0 || f.decimals > 6)
        ) {
          issue(p('decimals'), 'invalid_limit', 'decimals is 0–6');
        }
        if (f.unit !== undefined && (!isStr(f.unit) || f.unit.length > 20)) {
          issue(p('unit'), 'invalid_unit', 'unit is short text');
        }
        if (f.defaultValue !== undefined && !Number.isFinite(f.defaultValue)) {
          issue(
            p('defaultValue'),
            'invalid_default',
            'The default must be a number',
          );
        }
        break;
      }
      case 'boolean':
        if (
          f.defaultValue !== undefined &&
          typeof f.defaultValue !== 'boolean'
        ) {
          issue(
            p('defaultValue'),
            'invalid_default',
            'The default is true or false',
          );
        }
        break;
      case 'file':
        if (
          f.maxFiles !== undefined &&
          (!isInt(f.maxFiles) || f.maxFiles < 1 || f.maxFiles > 50)
        ) {
          issue(p('maxFiles'), 'invalid_limit', 'maxFiles is 1–50');
        }
        if (
          f.accept !== undefined &&
          (!Array.isArray(f.accept) || !f.accept.every(isStr))
        ) {
          issue(p('accept'), 'invalid_accept', 'accept lists mime types');
        }
        break;
      case 'tooth_chart':
        toothCharts++;
        checkToothChart(f, p, issue);
        break;
      case 'date':
        break;
    }

    seen.set(key, field);
    fields.push(field);
  });

  if (toothCharts > 1) {
    issue(
      'fields',
      'multiple_tooth_charts',
      'A form can have only one tooth chart',
    );
  }

  const ui = checkUi(uiJson, seen, issue);
  const promotions = checkPromotions(promotionsJson, seen, issue);
  return { issues, definition: { fields }, ui, promotions };
}

function normaliseOptions(raw: unknown): FieldOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FieldOption[] = [];
  for (const o of raw) {
    if (isStr(o) && o.trim() && o.length <= 100) {
      out.push({ value: o, label: o });
    } else if (
      isObj(o) &&
      isStr(o.value) &&
      o.value.trim() &&
      o.value.length <= 100 &&
      isStr(o.label) &&
      o.label.trim() &&
      o.label.length <= 150
    ) {
      out.push({ value: o.value, label: o.label });
    } else {
      return null;
    }
  }
  return out;
}

function checkToothChart(
  f: Obj,
  p: (prop: string) => string,
  issue: (path: string, code: string, message: string) => void,
): void {
  if (f.numbering !== undefined && f.numbering !== 'FDI') {
    issue(
      p('numbering'),
      'invalid_numbering',
      'Only FDI numbering is supported',
    );
  }
  let roles: readonly ToothRole[] = TOOTH_ROLES;
  if (f.roles !== undefined) {
    const ok =
      Array.isArray(f.roles) &&
      f.roles.length > 0 &&
      f.roles.every((r) => TOOTH_ROLES.includes(r as ToothRole)) &&
      new Set(f.roles).size === f.roles.length;
    if (!ok) {
      issue(
        p('roles'),
        'invalid_roles',
        `roles is a list of: ${TOOTH_ROLES.join(', ')}`,
      );
    } else {
      roles = f.roles as ToothRole[];
    }
  }
  for (const prop of ['minTeeth', 'maxTeeth'] as const) {
    if (
      f[prop] !== undefined &&
      (!isInt(f[prop]) || f[prop] < 1 || f[prop] > 52)
    ) {
      issue(p(prop), 'invalid_limit', `${prop} is 1–52`);
    }
  }
  if (isInt(f.minTeeth) && isInt(f.maxTeeth) && f.minTeeth > f.maxTeeth) {
    issue(p('minTeeth'), 'invalid_limit', 'minTeeth is larger than maxTeeth');
  }
  if (f.minPerRole !== undefined) {
    if (!isObj(f.minPerRole)) {
      issue(
        p('minPerRole'),
        'invalid_limit',
        'minPerRole maps a role to a count',
      );
    } else {
      let sum = 0;
      for (const [role, n] of Object.entries(f.minPerRole)) {
        if (!roles.includes(role as ToothRole) || !isInt(n) || n < 1) {
          issue(
            p('minPerRole'),
            'invalid_limit',
            `minPerRole.${role} must be a count for an allowed role`,
          );
        } else {
          sum += n;
        }
      }
      if (isInt(f.maxTeeth) && sum > f.maxTeeth) {
        issue(
          p('minPerRole'),
          'invalid_limit',
          'minPerRole needs more teeth than maxTeeth allows',
        );
      }
    }
  }
  for (const prop of ['sameArch', 'withSurfaces'] as const) {
    if (f[prop] !== undefined && typeof f[prop] !== 'boolean') {
      issue(p(prop), 'invalid_flag', `${prop} is true or false`);
    }
  }
  if (
    f.dentition !== undefined &&
    !['permanent', 'primary', 'any'].includes(f.dentition as string)
  ) {
    issue(
      p('dentition'),
      'invalid_dentition',
      'dentition is permanent, primary or any',
    );
  }
}

function checkUi(
  uiJson: unknown,
  fields: Map<string, FieldDef>,
  issue: (path: string, code: string, message: string) => void,
): FormUi | null {
  if (uiJson === null || uiJson === undefined) return null;
  if (!isObj(uiJson)) {
    issue('ui', 'invalid_ui', 'The layout must be an object');
    return null;
  }
  if (uiJson.sections !== undefined) {
    if (!Array.isArray(uiJson.sections)) {
      issue('ui.sections', 'invalid_ui', 'sections is a list');
    } else {
      const placed = new Set<string>();
      uiJson.sections.forEach((s, i) => {
        if (!isObj(s) || !isStr(s.title) || !Array.isArray(s.fields)) {
          issue(
            `ui.sections[${i}]`,
            'invalid_ui',
            'Each section has a title and a fields list',
          );
          return;
        }
        for (const key of s.fields) {
          if (!isStr(key) || !fields.has(key)) {
            issue(
              `ui.sections[${i}]`,
              'unknown_field',
              `Section "${s.title}" lists unknown field "${String(key)}"`,
            );
          } else if (placed.has(key)) {
            issue(
              `ui.sections[${i}]`,
              'duplicate_field',
              `"${key}" is in two sections`,
            );
          } else {
            placed.add(key);
          }
        }
      });
    }
  }
  return uiJson as FormUi;
}

function checkPromotions(
  raw: unknown,
  fields: Map<string, FieldDef>,
  issue: (path: string, code: string, message: string) => void,
): Promotions {
  if (raw === null || raw === undefined) return {};
  if (!isObj(raw)) {
    issue(
      'promotions',
      'invalid_promotions',
      'Promotions map a field key to a column',
    );
    return {};
  }
  const used = new Set<string>();
  const out: Promotions = {};
  for (const [key, target] of Object.entries(raw)) {
    const field = fields.get(key);
    const at = `promotions.${key}`;
    if (!field) {
      issue(at, 'unknown_field', `No field "${key}" to promote`);
      continue;
    }
    if (!isStr(target) || !(target in PROMOTION_TARGETS)) {
      issue(
        at,
        'unknown_column',
        `"${String(target)}" is not a promotable column`,
      );
      continue;
    }
    if (!PROMOTION_TARGETS[target].includes(field.type)) {
      issue(
        at,
        'incompatible_column',
        `A ${field.type} field cannot fill ${target}`,
      );
      continue;
    }
    if (used.has(target)) {
      issue(at, 'duplicate_column', `${target} is filled by two fields`);
      continue;
    }
    used.add(target);
    out[key] = target;
  }
  return out;
}
