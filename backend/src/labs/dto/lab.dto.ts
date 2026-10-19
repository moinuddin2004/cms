import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  LabLinkStatus,
  LabMemberRole,
  LabStatus,
  LabType,
  PatientDataLevel,
} from '../enums/lab.enums';
import type { LabLinkAction } from '../links/lab-link-transitions';

/** Trims strings; blank becomes null so optional fields can be cleared. */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const PHONE = /^\+?[0-9][0-9\s-]{6,18}$/;
const PHONE_MESSAGE = 'Enter a valid phone number (digits, spaces, dashes)';

// ── Pagination ────────────────────────────────────────────────────────────

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100)
  search?: string | null;
}

// ── Labs (platform admin) ───────────────────────────────────────────────

class LabFieldsDto {
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @Matches(PHONE, { message: PHONE_MESSAGE })
  whatsappPhone?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  address?: string | null;
}

export class CreateLabDto extends LabFieldsDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEnum(LabType)
  labType: LabType;

  /** Required for internal labs, forbidden for external ones. */
  @ValidateIf((o: CreateLabDto) => o.labType === LabType.INTERNAL)
  @IsUUID()
  ownerOrganizationId?: string | null;
}

/** Type and owner are fixed at creation — they decide who may see the lab. */
export class UpdateLabDto extends LabFieldsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsInt()
  @Min(1)
  version: number;
}

export class SetLabStatusDto {
  @IsEnum(LabStatus)
  status: LabStatus;

  @IsInt()
  @Min(1)
  version: number;
}

export class ListLabsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(LabStatus)
  status?: LabStatus;

  @IsOptional()
  @IsEnum(LabType)
  labType?: LabType;
}

// ── Lab members (platform admin) ────────────────────────────────────────

export class AddLabMemberDto {
  /** Email of an existing account (create it from Users first). */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsEnum(LabMemberRole)
  role: LabMemberRole;
}

export class UpdateLabMemberDto {
  @IsOptional()
  @IsEnum(LabMemberRole)
  role?: LabMemberRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  version: number;
}

// ── Lab ↔ clinic links (clinic admin) ───────────────────────────────────

class LinkTermsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  paymentTermsDays?: number;

  @IsOptional()
  @IsEnum(PatientDataLevel)
  patientDataLevel?: PatientDataLevel;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class CreateLabLinkDto extends LinkTermsDto {
  @IsUUID()
  labId: string;
}

export class UpdateLabLinkDto extends LinkTermsDto {
  @IsInt()
  @Min(1)
  version: number;
}

export const LINK_ACTIONS: LabLinkAction[] = [
  'activate',
  'suspend',
  'reactivate',
];

export class LabLinkTransitionDto {
  @IsIn(LINK_ACTIONS)
  action: LabLinkAction;

  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class ListLabLinksQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(LabLinkStatus)
  status?: LabLinkStatus;
}

export class LabDirectoryQueryDto {
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100)
  search?: string | null;
}
