import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  DiscountAppliesTo,
  DiscountKind,
  ServiceKind,
} from '../enums/billing.enums';
import { toBool, trim, upper } from './config.dto';

export class CreateDiscountTypeDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @Transform(upper) @IsString() @MaxLength(30) code?: string;
  @IsEnum(DiscountKind) kind: DiscountKind;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) maxAmount?:
    | number
    | null;
  @IsOptional() @IsEnum(DiscountAppliesTo) appliesTo?: DiscountAppliesTo;
  @IsOptional() @IsArray() @IsEnum(ServiceKind, { each: true }) serviceKinds?:
    | ServiceKind[]
    | null;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) serviceIds?:
    | string[]
    | null;
  @IsOptional() @IsBoolean() receptionEditable?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minValue?:
    | number
    | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maxValue?:
    | number
    | null;
  @IsOptional() @IsBoolean() requiresNote?: boolean;
  @IsOptional() @IsISO8601({ strict: true }) validFrom?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) validTo?: string | null;
}

export class UpdateDiscountTypeDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
  @IsOptional() @Transform(upper) @IsString() @MaxLength(30) code?:
    | string
    | null;
  @IsOptional() @IsEnum(DiscountKind) kind?: DiscountKind;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) maxAmount?:
    | number
    | null;
  @IsOptional() @IsEnum(DiscountAppliesTo) appliesTo?: DiscountAppliesTo;
  @IsOptional() @IsArray() @IsEnum(ServiceKind, { each: true }) serviceKinds?:
    | ServiceKind[]
    | null;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) serviceIds?:
    | string[]
    | null;
  @IsOptional() @IsBoolean() receptionEditable?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minValue?:
    | number
    | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maxValue?:
    | number
    | null;
  @IsOptional() @IsBoolean() requiresNote?: boolean;
  @IsOptional() @IsISO8601({ strict: true }) validFrom?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) validTo?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListDiscountTypesQueryDto {
  @IsOptional() @Transform(toBool) @IsBoolean() usableToday?: boolean;
}

/** Apply a discount to one charge: a type, or custom (kind + value, admin). */
export class ApplyDiscountDto {
  @IsOptional() @IsUUID('4') discountTypeId?: string | null;
  @IsOptional() @IsEnum(DiscountKind) kind?: DiscountKind;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) note?: string;
}

export class BulkDiscountDto extends ApplyDiscountDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  chargeIds: string[];
}
