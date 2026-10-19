// Configuration Studio (lab ERD §18) — mirrors backend/src/engine responses.

export type DefinitionStatus = 'draft' | 'published' | 'retired'

export interface Specialty {
  id: string
  code: string
  name: string
  isActive: boolean
  enabledByDefault: boolean
  version: number
}

export interface Owner {
  id: string
  name: string
}

/** A problem that blocks publishing (or an answer the server rejected). */
export interface Issue {
  path: string
  code: string
  message: string
}

export interface VersionRow {
  id: string
  versionNo: number
  status: DefinitionStatus
  publishedAt: string | null
  retiredAt: string | null
  createdAt: string
}

interface DefinitionSummary {
  id: string
  specialty: { id: string; code: string; name: string }
  /** Null = platform default. */
  organization: Owner | null
  code: string
  name: string
  description: string | null
  isActive: boolean
  current: { id: string; versionNo: number; publishedAt: string } | null
  draft: { id: string; versionNo: number } | null
  version: number
  createdAt: string
  updatedAt: string
}

// ── Form schemas ─────────────────────────────────────────────────────────

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
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const TOOTH_ROLES = ['crown', 'abutment', 'pontic', 'implant'] as const
export type ToothRole = (typeof TOOTH_ROLES)[number]
export const TOOTH_SURFACES = ['M', 'O', 'D', 'B', 'L', 'I'] as const

export interface FieldOption {
  value: string
  label: string
}

/**
 * One field of a form definition. Loose on purpose: drafts are work in
 * progress, so the preview reads whatever is there and the server's
 * `issues` say what is wrong.
 */
export interface FieldDef {
  key: string
  type: FieldType
  label: string
  help?: string
  required?: boolean
  visibleIf?: { field: string; in: (string | boolean)[] }
  options?: FieldOption[]
  defaultValue?: unknown
  maxLength?: number
  min?: number
  max?: number
  decimals?: number
  unit?: string
  maxFiles?: number
  accept?: string[]
  numbering?: 'FDI'
  roles?: ToothRole[]
  minTeeth?: number
  maxTeeth?: number
  minPerRole?: Partial<Record<ToothRole, number>>
  sameArch?: boolean
  dentition?: 'permanent' | 'primary' | 'any'
  withSurfaces?: boolean
}

export interface FormDefinition {
  fields: FieldDef[]
}

export interface FormUi {
  sections?: { title: string; fields: string[] }[]
  [key: string]: unknown
}

export type Promotions = Record<string, string>

export interface ToothAnswer {
  tooth: string
  role?: ToothRole
  surfaces?: string[]
}

export type FormSchemaSummary = DefinitionSummary

export interface FormSchemaDetail extends FormSchemaSummary {
  versions: VersionRow[]
}

export interface FormVersion {
  id: string
  formSchemaId: string
  versionNo: number
  status: DefinitionStatus
  schemaJson: FormDefinition
  uiJson: FormUi | null
  promotions: Promotions | null
  publishedAt: string | null
  retiredAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  issues: Issue[]
}

export interface FormDataResult {
  ok: boolean
  issues: Issue[]
  value: Record<string, unknown>
  definitionIssues: Issue[]
}

export interface FormSchemaListParams {
  specialtyId?: string
  owner?: string
}

export interface CreateFormSchemaInput {
  specialtyId: string
  organizationId?: string
  code: string
  name: string
  description?: string | null
  copyFromVersionId?: string
}

// ── Workflows ────────────────────────────────────────────────────────────

export const WORKFLOW_ENTITY_TYPES = ['order', 'item', 'stage'] as const
export type WorkflowEntityType = (typeof WORKFLOW_ENTITY_TYPES)[number]

export const STATE_CATEGORIES = [
  'initial',
  'active',
  'waiting',
  'done',
  'cancelled',
] as const
export type StateCategory = (typeof STATE_CATEGORIES)[number]

export const TRANSITION_SIDES = ['clinic', 'lab', 'system'] as const
export type TransitionSide = (typeof TRANSITION_SIDES)[number]

/** Every role a transition may name (clinic app roles + lab member roles). */
export const KNOWN_ROLES = [
  'clinic_admin',
  'receptionist',
  'doctor',
  'lab_admin',
  'lab_technician',
] as const

/** Order status changes the engine computes itself; system side only. */
export const DERIVED_ACTION = 'derive'

export interface StateDef {
  code: string
  name: string
  category: StateCategory
}

export interface EffectRef {
  code: string
  params?: Record<string, unknown>
}

export interface TransitionDef {
  from: string
  to: string
  action: string
  allowedRoles?: string[]
  allowedSides: TransitionSide[]
  requiredFields?: string[]
  requiresReason?: boolean
  effects?: EffectRef[]
}

export interface WorkflowDefinition {
  states: StateDef[]
  transitions: TransitionDef[]
}

export interface SimulationRun {
  terminal: string
  /** Shortest action path from the initial state; null = unreachable. */
  path: { from: string; action: string; to: string }[] | null
}

export interface WorkflowTemplateSummary extends DefinitionSummary {
  entityType: WorkflowEntityType
}

export interface WorkflowTemplateDetail extends WorkflowTemplateSummary {
  versions: VersionRow[]
}

export interface WorkflowVersion {
  id: string
  workflowTemplateId: string
  versionNo: number
  status: DefinitionStatus
  definition: WorkflowDefinition
  publishedAt: string | null
  retiredAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  issues: Issue[]
  simulation: SimulationRun[]
}

export interface WorkflowEffect {
  code: string
  description: string
  isFinancial: boolean
}

export interface WorkflowListParams {
  specialtyId?: string
  entityType?: WorkflowEntityType
  owner?: string
}

export interface CreateWorkflowInput {
  specialtyId: string
  organizationId?: string
  entityType: WorkflowEntityType
  code: string
  name: string
  description?: string | null
  copyFromVersionId?: string
}

// ── Stage templates ──────────────────────────────────────────────────────

export interface StageStep {
  code: string
  name: string
  requiresPatientVisit: boolean
  requiresDoctorApproval: boolean
  defaultLabDays: number
}

export interface StageTemplate {
  id: string
  specialty: { id: string; code: string }
  organization: Owner | null
  code: string
  name: string
  isActive: boolean
  steps: (StageStep & { seq: number })[]
  version: number
}

export interface CreateStageTemplateInput {
  specialtyId: string
  organizationId?: string
  code: string
  name: string
  steps: StageStep[]
}

export interface UpdateStageTemplateInput {
  name?: string
  isActive?: boolean
  steps?: StageStep[]
  version: number
}

export interface TimelineEntry {
  id: string
  kind: 'audit' | 'status'
  action: string
  fromState: string | null
  toState: string | null
  changes: {
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  } | null
  reason: string | null
  actorSide: 'clinic' | 'lab' | 'platform' | 'system'
  via: string | null
  actor: { id: string; name: string | null } | null
  createdAt: string
}

export const ENTITY_TYPE_LABEL: Record<WorkflowEntityType, string> = {
  order: 'Order',
  item: 'Item',
  stage: 'Stage',
}

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  tooth_chart: 'Tooth chart',
  select: 'Select',
  multi_select: 'Multi-select',
  text: 'Text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes / no',
  file: 'Files',
}
