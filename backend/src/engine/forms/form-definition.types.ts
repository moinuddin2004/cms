/**
 * Form schema definition — the JSON a form schema version stores in
 * `schema_json` (lab ERD §3, §17). The frontend renders one component per
 * field `type`; the server validates submitted answers against the SAME
 * version, so the two can never disagree.
 */

export const FIELD_TYPES = [
  'tooth_chart',
  'select',
  'multi_select',
  'text',
  'textarea',
  'number',
  'date',
  'boolean',
  'file',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldOption {
  value: string;
  label: string;
}

/** Show a field only when another (earlier) field has one of these values. */
export interface VisibleIf {
  field: string;
  /** Matches when the other field's value (or one of its values) is listed. */
  in: (string | boolean)[];
}

interface BaseField {
  /** Stable key in the answers object: `^[a-z][a-z0-9_]{0,49}$`. */
  key: string;
  type: FieldType;
  label: string;
  help?: string;
  required?: boolean;
  visibleIf?: VisibleIf;
}

export interface ToothChartField extends BaseField {
  type: 'tooth_chart';
  /** Only FDI today (lab ERD decision: FDI default, configurable later). */
  numbering?: 'FDI';
  /** Roles a tooth may take; the first is the default the UI picks. */
  roles?: ToothRole[];
  minTeeth?: number;
  maxTeeth?: number;
  /** Minimum count per role, e.g. a bridge needs 2 abutments + 1 pontic. */
  minPerRole?: Partial<Record<ToothRole, number>>;
  /** All teeth in one arch (bridges). */
  sameArch?: boolean;
  dentition?: 'permanent' | 'primary' | 'any';
  /** Allow surfaces (M O D B L I) per tooth. */
  withSurfaces?: boolean;
}

export interface SelectField extends BaseField {
  type: 'select' | 'multi_select';
  options: FieldOption[];
  defaultValue?: string | string[];
}

export interface TextField extends BaseField {
  type: 'text' | 'textarea';
  maxLength?: number;
  defaultValue?: string;
}

export interface NumberField extends BaseField {
  type: 'number';
  min?: number;
  max?: number;
  /** Decimal places allowed (0 = integers). */
  decimals?: number;
  unit?: string;
  defaultValue?: number;
}

export interface DateField extends BaseField {
  type: 'date';
}

export interface BooleanField extends BaseField {
  type: 'boolean';
  defaultValue?: boolean;
}

/** Answer = attachment ids (uploads arrive with orders, Sprint 6). */
export interface FileField extends BaseField {
  type: 'file';
  maxFiles?: number;
  /** e.g. ['image/*', 'model/stl'] — enforced at upload time. */
  accept?: string[];
}

export type FieldDef =
  | ToothChartField
  | SelectField
  | TextField
  | NumberField
  | DateField
  | BooleanField
  | FileField;

export interface FormDefinition {
  fields: FieldDef[];
}

/** Optional layout: which fields go in which section, in order. */
export interface FormUi {
  sections?: { title: string; fields: string[] }[];
  [key: string]: unknown;
}

/** Field key → typed column (`table.column`) its answer is copied into. */
export type Promotions = Record<string, string>;

export const TOOTH_ROLES = ['crown', 'abutment', 'pontic', 'implant'] as const;
export type ToothRole = (typeof TOOTH_ROLES)[number];

export const TOOTH_SURFACES = ['M', 'O', 'D', 'B', 'L', 'I'] as const;

/** A tooth chart answer: one entry per tooth. */
export interface ToothAnswer {
  tooth: string;
  role?: ToothRole;
  surfaces?: string[];
}

export interface FormIssue {
  /** Field key, or a JSON-ish path for definition issues (`fields[2].options`). */
  path: string;
  code: string;
  message: string;
}
