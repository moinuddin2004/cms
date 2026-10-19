import { Transform, Type } from 'class-transformer';
import {
  WORKFLOW_ENTITY_TYPES,
  type WorkflowEntityType,
} from '../workflows/workflow.types';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  Max,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

const CODE = /^[A-Z][A-Z0-9_]{1,49}$/;
const CODE_MESSAGE =
  'Codes are upper-case letters, digits and _ (start with a letter)';

// ── Specialties (platform admin) ─────────────────────────────────────────

export class CreateSpecialtyDto {
  @Transform(upper)
  @Matches(CODE, { message: CODE_MESSAGE })
  @MaxLength(30)
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsBoolean()
  enabledByDefault?: boolean;
}

export class UpdateSpecialtyDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  enabledByDefault?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}

export class SetOrganizationSpecialtyDto {
  @IsBoolean()
  isEnabled: boolean;
}

// ── Form schemas (platform admin) ───────────────────────────────────────

export class ListFormSchemasQueryDto {
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  /** `platform` (defaults only), an organization id, or omitted for all. */
  @IsOptional()
  @ValidateIf((_, v) => v !== 'platform')
  @IsUUID()
  owner?: string;
}

export class CreateFormSchemaDto {
  @IsUUID()
  specialtyId: string;

  /** Omit for a platform default. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @Transform(upper)
  @Matches(CODE, { message: CODE_MESSAGE })
  @MaxLength(50)
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  /** Start the first draft as a copy of this version (forking a default). */
  @IsOptional()
  @IsUUID()
  copyFromVersionId?: string;
}

export class UpdateFormSchemaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}

export class CreateDraftDto {
  /** Copy content from this version; default: the newest version. */
  @IsOptional()
  @IsUUID()
  fromVersionId?: string;
}

/**
 * Draft content. Shape is checked by the definition checker (issues come
 * back with the draft), not here — a draft may be work in progress.
 */
export class UpdateDraftDto {
  @IsDefined()
  @IsObject()
  schemaJson: Record<string, unknown>;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  uiJson?: Record<string, unknown> | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  promotions?: Record<string, unknown> | null;

  @IsInt()
  @Min(1)
  version: number;
}

export class VersionActionDto {
  @IsInt()
  @Min(1)
  version: number;
}

export class ValidateFormDataDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  data?: Record<string, unknown> | null;
}

// ── Clinic ─────────────────────────────────────────────────────────────

export class CurrentFormsQueryDto {
  @IsOptional()
  @Transform(upper)
  @Matches(CODE, { message: CODE_MESSAGE })
  specialty?: string;
}

// ── Workflow templates (platform admin) ─────────────────────────────────

export class ListWorkflowTemplatesQueryDto {
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @IsOptional()
  @IsIn(WORKFLOW_ENTITY_TYPES)
  entityType?: WorkflowEntityType;

  /** `platform` (defaults only), an organization id, or omitted for all. */
  @IsOptional()
  @ValidateIf((_, v) => v !== 'platform')
  @IsUUID()
  owner?: string;
}

export class CreateWorkflowTemplateDto {
  @IsUUID()
  specialtyId: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsIn(WORKFLOW_ENTITY_TYPES)
  entityType: WorkflowEntityType;

  @Transform(upper)
  @Matches(CODE, { message: CODE_MESSAGE })
  @MaxLength(50)
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  /** Start the first draft as a copy of this version. */
  @IsOptional()
  @IsUUID()
  copyFromVersionId?: string;
}

export class UpdateWorkflowTemplateDto extends UpdateFormSchemaDto {}

/** Draft definition `{ states, transitions }`; checked, not rejected. */
export class UpdateWorkflowDraftDto {
  @IsDefined()
  @IsObject()
  definition: Record<string, unknown>;

  @IsInt()
  @Min(1)
  version: number;
}

// ── Stage templates (platform admin) ────────────────────────────────────

export class StageStepDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^[a-z][a-z0-9_]{0,49}$/, {
    message: 'Step codes are lowercase letters, digits and _',
  })
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsBoolean()
  requiresPatientVisit: boolean;

  @IsBoolean()
  requiresDoctorApproval: boolean;

  @IsInt()
  @Min(0)
  @Max(365)
  defaultLabDays: number;
}

export class CreateStageTemplateDto {
  @IsUUID()
  specialtyId: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @Transform(upper)
  @Matches(CODE, { message: CODE_MESSAGE })
  @MaxLength(50)
  code: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  /** In order: step 1 first. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StageStepDto)
  steps: StageStepDto[];
}

export class UpdateStageTemplateDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Replaces all steps. Stages already created by orders keep their copies. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => StageStepDto)
  steps?: StageStepDto[];

  @IsInt()
  @Min(1)
  version: number;
}

export class ListStageTemplatesQueryDto {
  @IsOptional()
  @IsUUID()
  specialtyId?: string;
}
