import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  ValidateNested,
} from 'class-validator';
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../billing.constants';
import { AllocationMode, PaymentMethod } from '../enums/billing.enums';
import { PageQueryDto, trim } from './config.dto';

export class ChargeSelectionDto {
  @IsUUID('4') chargeId: string;
  /** Required in MANUAL mode. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number;
}

/** Body of POST /payments/preview — amount may still be 0 while typing. */
export class PreviewPaymentDto {
  @IsUUID('4') patientId: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount: number;
  @IsOptional() @IsUUID('4') paymentAccountId?: string;
  @IsBoolean() applyAdvance: boolean;
  @IsEnum(AllocationMode) mode: AllocationMode;
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ChargeSelectionDto)
  selections: ChargeSelectionDto[];
}

/** POST /payments (6.5, 7.6). */
export class CollectPaymentDto extends PreviewPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) declare amount: number;
  @IsUUID('4') declare paymentAccountId: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  referenceNumber?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) notes?: string;
  @IsUUID('4') clientRequestId: string;
}

/** POST /patients/:patientId/advance/apply. */
export class ApplyAdvanceDto {
  @IsEnum(AllocationMode) mode: AllocationMode;
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ChargeSelectionDto)
  selections: ChargeSelectionDto[];
}

export class UnapplyLineDto {
  @IsUUID('4') chargeId: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
}

export class UnapplyPaymentDto {
  @Transform(trim)
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  reason: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UnapplyLineDto)
  lines?: UnapplyLineDto[];
}

export class ListPaymentsQueryDto extends PageQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsUUID('4') paymentAccountId?: string;
  @IsOptional() @IsUUID('4') patientId?: string;
}

export class DailyCollectionQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) date?: string;
}
