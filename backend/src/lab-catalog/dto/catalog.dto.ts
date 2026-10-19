import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from 'src/labs/dto/lab.dto';
import { OptionType, UnitType } from '../enums/catalog.enums';
import { MAX_PAISA, MAX_TEMPLATE_ITEMS } from '../lab-catalog.constants';

/** Trims strings; blank becomes null so optional fields can be cleared. */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upperCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
/**
 * Query-string booleans: "true" / "false". Reads the raw value — implicit
 * conversion would already have turned "false" into `true`.
 */
const queryBool = ({
  value,
  obj,
  key,
}: {
  value: unknown;
  obj: Record<string, unknown>;
  key: string;
}) => {
  const raw = obj[key] ?? value;
  if (raw === 'true' || raw === true) return true;
  if (raw === 'false' || raw === false) return false;
  return raw;
};
/** Query-string uuid lists: "a,b" or repeated params. */
const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : value;

const CODE = /^[A-Z][A-Z0-9_]{0,49}$/;
const CODE_MESSAGE =
  'Use capital letters, digits and underscores, starting with a letter';
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const YMD_MESSAGE = 'Use a date like 2026-10-19';

// ── Service categories (platform admin) ────────────────────────────────

export class ListCategoriesQueryDto {
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateCategoryDto {
  @IsUUID()
  specialtyId: string;

  @Transform(upperCode)
  @Matches(CODE, { message: CODE_MESSAGE })
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}

// ── Lab services (platform admin; later the lab portal) ────────────────

export class ListLabServicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  isActive?: boolean;
}

class LabServiceFieldsDto {
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  defaultTurnaroundDays?: number;

  /** Platform form (same specialty). Null = no form for this service. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  formSchemaId?: string | null;

  /** Platform item workflow (same specialty). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  workflowTemplateId?: string | null;

  /** Platform try-in stage template (same specialty). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  stageTemplateId?: string | null;
}

export class CreateLabServiceDto extends LabServiceFieldsDto {
  /** The specialty comes from the category. */
  @IsUUID()
  categoryId: string;

  @Transform(upperCode)
  @Matches(CODE, { message: CODE_MESSAGE })
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEnum(UnitType)
  unitType: UnitType;
}

/** The code is fixed at creation; the category may move within its specialty. */
export class UpdateLabServiceDto extends LabServiceFieldsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEnum(UnitType)
  unitType?: UnitType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}

export class CreateOptionDto {
  @IsEnum(OptionType)
  optionType: OptionType;

  @Transform(upperCode)
  @Matches(CODE, { message: CODE_MESSAGE })
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  extraCostPaisa: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateOptionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  extraCostPaisa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}

// ── Lab service prices ─────────────────────────────────────────────────

export class ListPricesQueryDto {
  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  includeVoided?: boolean;
}

export class CreatePriceDto {
  /** A clinic's negotiated price; omit / null for the lab's list price. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  organizationId?: string | null;

  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  unitPricePaisa: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  rushSurchargePaisa?: number;

  @Matches(YMD, { message: YMD_MESSAGE })
  effectiveFrom: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(YMD, { message: YMD_MESSAGE })
  effectiveTo?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePriceDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  unitPricePaisa?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  rushSurchargePaisa?: number;

  @IsOptional()
  @Matches(YMD, { message: YMD_MESSAGE })
  effectiveFrom?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(YMD, { message: YMD_MESSAGE })
  effectiveTo?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsInt()
  @Min(1)
  version: number;
}

export class VoidPriceDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @IsInt()
  @Min(1)
  version: number;
}

// ── Clinic side ────────────────────────────────────────────────────────

export class ClinicLabServicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  labId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Only services mapped (true) / not yet mapped (false) to a treatment. */
  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  mapped?: boolean;
}

export class PriceQuoteQueryDto {
  @IsUUID()
  labServiceId: string;

  @IsOptional()
  @Transform(csv)
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  optionIds?: string[];

  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  rush?: boolean;

  /** Defaults to today. */
  @IsOptional()
  @Matches(YMD, { message: YMD_MESSAGE })
  on?: string;

  /** Bill as this treatment instead of the mapped one. */
  @IsOptional()
  @IsUUID()
  clinicTreatmentId?: string;

  /** Doctor (employee) price override, as billing applies it. */
  @IsOptional()
  @IsUUID()
  doctorId?: string;
}

export class ListMappingsQueryDto {
  @IsOptional()
  @IsUUID()
  clinicTreatmentId?: string;

  @IsOptional()
  @IsUUID()
  labId?: string;

  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateMappingDto {
  @IsUUID()
  clinicTreatmentId: string;

  @IsUUID()
  labServiceId: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateMappingDto {
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}

// ── Order templates ────────────────────────────────────────────────────

export const TEMPLATE_SCOPES = ['all', 'mine', 'shared'] as const;
export type TemplateScope = (typeof TEMPLATE_SCOPES)[number];

export class ListTemplatesQueryDto extends PageQueryDto {
  /** `all` = shared + the caller's own (never other users' private ones). */
  @IsOptional()
  @IsIn(TEMPLATE_SCOPES)
  scope?: TemplateScope;

  @IsOptional()
  @IsUUID()
  labId?: string;

  @IsOptional()
  @Transform(queryBool)
  @IsBoolean()
  includeInactive?: boolean;
}

export class TemplateItemDto {
  @IsUUID()
  labServiceId: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  optionIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  rush?: boolean;

  /** Form answers to pre-fill; checked against the service's form. */
  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;
}

/** The lab and specialty come from the items (one order goes to one lab). */
class TemplateFieldsDto {
  /** Shared with the whole clinic (clinic admins only) vs. the caller's own. */
  @IsOptional()
  @IsBoolean()
  shared?: boolean;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreateTemplateDto extends TemplateFieldsDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TEMPLATE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items: TemplateItemDto[];
}

export class UpdateTemplateDto extends TemplateFieldsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TEMPLATE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items?: TemplateItemDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}
