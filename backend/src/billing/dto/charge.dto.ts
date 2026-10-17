import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../billing.constants';
import { trim } from './config.dto';

/** Catalog service (price resolved) or "Other" (`serviceId` absent). */
export class CreateManualChargeDto {
  @IsOptional() @IsUUID('4') serviceId?: string;
  @ValidateIf((o: CreateManualChargeDto) => !o.serviceId)
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description?: string;
  @IsOptional() @IsInt() @Min(1) @Max(999) quantity?: number;
  /** Required for "Other"; for a catalog service only an admin may set it. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice?: number;
  @IsOptional() @IsUUID('4') doctorId?: string;
  @IsOptional() @IsISO8601({ strict: true }) chargeDate?: string;
}

export class UpdateChargeDto {
  @IsOptional() @IsInt() @Min(1) @Max(999) quantity?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice?: number;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description?: string;
  @IsOptional() @IsUUID('4') doctorId?: string | null;
}

export class ReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  reason: string;
}

export class ChargesFromPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  itemIds: string[];
}

export class ListChargesQueryDto {
  @IsOptional() @IsIn(['unbilled', 'open', 'all']) state?:
    | 'unbilled'
    | 'open'
    | 'all';
}

export class ReadyToBillQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) date?: string;
}
