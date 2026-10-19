import { LabServiceOption } from '../entities/lab-service-option.entity';
import { LabServicePrice } from '../entities/lab-service-price.entity';
import { LabService } from '../entities/lab-service.entity';
import { OrderTemplate } from '../entities/order-template.entity';
import { ServiceCategory } from '../entities/service-category.entity';
import { ServiceMapping } from '../entities/service-mapping.entity';
import { LabPriceSource, OptionType, UnitType } from '../enums/catalog.enums';
import type { OrderTemplateBody } from '../templates/order-template.types';

/** Fields the audit trail snapshots for each entity. */
export const CATEGORY_AUDIT_FIELDS = [
  'specialtyId',
  'code',
  'name',
  'sortOrder',
  'isActive',
] as const satisfies readonly (keyof ServiceCategory)[];

export const SERVICE_AUDIT_FIELDS = [
  'labId',
  'categoryId',
  'code',
  'name',
  'description',
  'unitType',
  'defaultTurnaroundDays',
  'formSchemaId',
  'workflowTemplateId',
  'stageTemplateId',
  'isActive',
] as const satisfies readonly (keyof LabService)[];

export const OPTION_AUDIT_FIELDS = [
  'labServiceId',
  'optionType',
  'code',
  'name',
  'extraCostPaisa',
  'sortOrder',
  'isActive',
] as const satisfies readonly (keyof LabServiceOption)[];

export const PRICE_AUDIT_FIELDS = [
  'labServiceId',
  'organizationId',
  'unitPricePaisa',
  'rushSurchargePaisa',
  'currency',
  'effectiveFrom',
  'effectiveTo',
  'notes',
  'voidedAt',
  'voidReason',
] as const satisfies readonly (keyof LabServicePrice)[];

export const MAPPING_AUDIT_FIELDS = [
  'clinicTreatmentId',
  'labServiceId',
  'isDefault',
  'isActive',
] as const satisfies readonly (keyof ServiceMapping)[];

export const TEMPLATE_AUDIT_FIELDS = [
  'ownerUserId',
  'specialtyId',
  'labId',
  'name',
  'templateJson',
  'isActive',
] as const satisfies readonly (keyof OrderTemplate)[];

export interface CategoryResponse {
  id: string;
  specialtyId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  serviceCount: number;
  version: number;
}

export const toCategoryResponse = (
  c: ServiceCategory,
  serviceCount = 0,
): CategoryResponse => ({
  id: c.id,
  specialtyId: c.specialtyId,
  code: c.code,
  name: c.name,
  sortOrder: c.sortOrder,
  isActive: c.isActive,
  serviceCount,
  version: c.version,
});

export interface OptionResponse {
  id: string;
  optionType: OptionType;
  code: string;
  name: string;
  extraCostPaisa: number;
  sortOrder: number;
  isActive: boolean;
  version: number;
}

export const toOptionResponse = (o: LabServiceOption): OptionResponse => ({
  id: o.id,
  optionType: o.optionType,
  code: o.code,
  name: o.name,
  extraCostPaisa: o.extraCostPaisa,
  sortOrder: o.sortOrder,
  isActive: o.isActive,
  version: o.version,
});

export interface PriceResponse {
  id: string;
  labServiceId: string;
  organization: { id: string; name: string } | null;
  unitPricePaisa: number;
  rushSurchargePaisa: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  version: number;
  createdAt: Date;
}

export const toPriceResponse = (p: LabServicePrice): PriceResponse => ({
  id: p.id,
  labServiceId: p.labServiceId,
  organization: p.organization
    ? { id: p.organization.id, name: p.organization.name }
    : null,
  unitPricePaisa: p.unitPricePaisa,
  rushSurchargePaisa: p.rushSurchargePaisa,
  currency: p.currency,
  effectiveFrom: p.effectiveFrom,
  effectiveTo: p.effectiveTo,
  notes: p.notes,
  voidedAt: p.voidedAt,
  voidReason: p.voidReason,
  version: p.version,
  createdAt: p.createdAt,
});

/** A price as a clinic sees it — never another clinic's negotiated rate. */
export interface EffectivePrice {
  priceId: string;
  source: LabPriceSource;
  unitPricePaisa: number;
  rushSurchargePaisa: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export const toEffectivePrice = (
  p: LabServicePrice,
  source: LabPriceSource,
): EffectivePrice => ({
  priceId: p.id,
  source,
  unitPricePaisa: p.unitPricePaisa,
  rushSurchargePaisa: p.rushSurchargePaisa,
  currency: p.currency,
  effectiveFrom: p.effectiveFrom,
  effectiveTo: p.effectiveTo,
});

export interface DefinitionRef {
  id: string;
  code: string;
  name: string;
}

const ref = (
  d: { id: string; code: string; name: string } | null | undefined,
): DefinitionRef | null =>
  d ? { id: d.id, code: d.code, name: d.name } : null;

export interface LabServiceResponse {
  id: string;
  labId: string;
  specialty: DefinitionRef;
  category: DefinitionRef;
  code: string;
  name: string;
  description: string | null;
  unitType: UnitType;
  defaultTurnaroundDays: number;
  formSchema: DefinitionRef | null;
  workflowTemplate: DefinitionRef | null;
  stageTemplate: DefinitionRef | null;
  isActive: boolean;
  options: OptionResponse[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Relations `specialty`, `category` and the definitions must be loaded. */
export function toServiceResponse(
  s: LabService,
  options: LabServiceOption[] = [],
): LabServiceResponse {
  return {
    id: s.id,
    labId: s.labId,
    specialty: ref(s.specialty)!,
    category: ref(s.category)!,
    code: s.code,
    name: s.name,
    description: s.description,
    unitType: s.unitType,
    defaultTurnaroundDays: s.defaultTurnaroundDays,
    formSchema: ref(s.formSchema),
    workflowTemplate: ref(s.workflowTemplate),
    stageTemplate: ref(s.stageTemplate),
    isActive: s.isActive,
    options: options
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(toOptionResponse),
    version: s.version,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

/** Platform listing row: the service plus its current list price. */
export interface PlatformServiceRow extends LabServiceResponse {
  listPrice: EffectivePrice | null;
  negotiatedPriceCount: number;
}

/** Clinic listing row: the service, this clinic's price and its mapping. */
export interface ClinicServiceRow extends LabServiceResponse {
  lab: { id: string; name: string; city: string | null };
  price: EffectivePrice | null;
  mapping: {
    id: string;
    clinicTreatmentId: string;
    clinicTreatmentName: string;
    isDefault: boolean;
  } | null;
}

export interface MappingResponse {
  id: string;
  clinicTreatment: {
    id: string;
    name: string;
    code: string | null;
    isActive: boolean;
    /** Org default patient price, paisa. */
    defaultPricePaisa: number;
  };
  labService: {
    id: string;
    code: string;
    name: string;
    unitType: UnitType;
    isActive: boolean;
    lab: { id: string; name: string };
  };
  isDefault: boolean;
  isActive: boolean;
  version: number;
  createdAt: Date;
}

export interface OrderTemplateResponse {
  id: string;
  name: string;
  shared: boolean;
  owner: { id: string; name: string | null } | null;
  specialtyId: string;
  lab: { id: string; name: string } | null;
  body: OrderTemplateBody;
  useCount: number;
  lastUsedAt: Date | null;
  isActive: boolean;
  /** The caller may edit / archive it. */
  canEdit: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
