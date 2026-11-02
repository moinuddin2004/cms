export type UnitType = 'per_tooth' | 'per_unit' | 'per_arch' | 'per_case'
export type OptionType = 'material' | 'variant'
export type LabPriceSource = 'negotiated' | 'list'
export type TemplateScope = 'all' | 'mine' | 'shared'

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  per_tooth: 'Per tooth',
  per_unit: 'Per unit',
  per_arch: 'Per arch',
  per_case: 'Per case',
}

export const OPTION_TYPE_LABEL: Record<OptionType, string> = {
  material: 'Material',
  variant: 'Variant',
}

export const PRICE_SOURCE_LABEL: Record<LabPriceSource, string> = {
  negotiated: 'Your rate',
  list: 'List price',
}

export interface DefinitionRef {
  id: string
  code: string
  name: string
}

export interface ServiceCategory {
  id: string
  specialtyId: string
  code: string
  name: string
  sortOrder: number
  isActive: boolean
  serviceCount: number
  version: number
}

export interface ServiceOption {
  id: string
  optionType: OptionType
  code: string
  name: string
  extraCostMinor: number
  sortOrder: number
  isActive: boolean
  version: number
}

export interface LabServiceItem {
  id: string
  labId: string
  specialty: DefinitionRef
  category: DefinitionRef
  code: string
  name: string
  description: string | null
  unitType: UnitType
  defaultTurnaroundDays: number
  formSchema: DefinitionRef | null
  workflowTemplate: DefinitionRef | null
  stageTemplate: DefinitionRef | null
  isActive: boolean
  options: ServiceOption[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface EffectivePrice {
  priceId: string
  source: LabPriceSource
  unitPriceMinor: number
  rushSurchargeMinor: number
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
}

/** Platform (super admin) listing row. */
export interface PlatformServiceRow extends LabServiceItem {
  listPrice: EffectivePrice | null
  negotiatedPriceCount: number
}

export interface PriceWindow {
  id: string
  labServiceId: string
  /** Null = the lab's list price. */
  organization: { id: string; name: string } | null
  unitPriceMinor: number
  rushSurchargeMinor: number
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
  notes: string | null
  voidedAt: string | null
  voidReason: string | null
  version: number
  createdAt: string
}

/** Clinic listing row: the price THIS clinic pays and its mapping. */
export interface ClinicServiceRow extends LabServiceItem {
  lab: { id: string; name: string; city: string | null }
  linkStatus: 'invited' | 'active' | 'suspended'
  price: EffectivePrice | null
  mapping: {
    id: string
    clinicTreatmentId: string
    clinicTreatmentName: string
    isDefault: boolean
  } | null
  patientPriceMinor: number | null
}

export interface ClinicTreatment {
  id: string
  name: string
  code: string | null
  kind: string
  isActive: boolean
  priceMinor: number
  mappedServiceCount: number
}

export interface ServiceMapping {
  id: string
  clinicTreatment: {
    id: string
    name: string
    code: string | null
    isActive: boolean
    defaultPriceMinor: number
  }
  labService: {
    id: string
    code: string
    name: string
    unitType: UnitType
    isActive: boolean
    lab: { id: string; name: string }
  }
  isDefault: boolean
  isActive: boolean
  version: number
  createdAt: string
}

export interface OrderTemplateItem {
  labServiceId: string
  optionIds: string[]
  quantity: number
  rush: boolean
  formCode: string | null
  answers: Record<string, unknown>
}

export interface OrderTemplate {
  id: string
  name: string
  shared: boolean
  owner: { id: string; name: string | null } | null
  specialtyId: string
  lab: { id: string; name: string } | null
  body: {
    schemaVersion: 1
    items: OrderTemplateItem[]
    notes: string | null
  }
  useCount: number
  lastUsedAt: string | null
  isActive: boolean
  canEdit: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface PriceQuote {
  on: string
  labService: {
    id: string
    labId: string
    code: string
    name: string
    unitType: UnitType
  }
  lab: {
    priceId: string
    source: LabPriceSource
    currency: string
    baseMinor: number
    optionsMinor: number
    rushMinor: number
    unitMinor: number
  }
  patient: {
    clinicTreatmentId: string
    name: string
    unitPriceMinor: number
    level: 'DOCTOR' | 'LOCATION' | 'DEFAULT'
  } | null
}

/** A published form as the clinic fills it (engine `GET /form-schemas`). */
export interface CurrentForm {
  formSchemaId: string
  code: string
  name: string
  versionId: string
  schemaJson: { fields: FormField[] }
}

export interface FormField {
  key: string
  type:
    | 'tooth_chart'
    | 'select'
    | 'multiselect'
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'boolean'
    | 'file'
  label: string
  required?: boolean
  options?: { value: string; label: string }[]
  visibleIf?: { field: string; in: unknown[] }
}

export interface TimelineEntry {
  id: string
  kind: 'audit' | 'status'
  action: string
  createdAt: string
  actor: { id: string; name: string | null } | null
}

// ── Inputs ──────────────────────────────────────────────────────────────

export interface LabServiceInput {
  categoryId: string
  code: string
  name: string
  description: string | null
  unitType: UnitType
  defaultTurnaroundDays: number
  formSchemaId: string | null
  workflowTemplateId: string | null
  stageTemplateId: string | null
}

export interface OptionInput {
  optionType: OptionType
  code: string
  name: string
  extraCostMinor: number
  sortOrder?: number
}

export interface PriceInput {
  organizationId: string | null
  unitPriceMinor: number
  rushSurchargeMinor: number
  effectiveFrom: string
  effectiveTo: string | null
  notes: string | null
}

export interface TemplateInput {
  name: string
  shared: boolean
  notes: string | null
  items: {
    labServiceId: string
    optionIds: string[]
    quantity: number
    rush: boolean
    answers: Record<string, unknown>
  }[]
}

export interface PlatformServiceParams {
  page: number
  limit: number
  search?: string
  categoryId?: string
  isActive?: boolean
}

export interface ClinicServiceParams {
  page: number
  limit: number
  search?: string
  labId?: string
  categoryId?: string
  mapped?: boolean
}

export interface TemplateParams {
  page: number
  limit: number
  search?: string
  scope?: TemplateScope
  labId?: string
  includeInactive?: boolean
}
