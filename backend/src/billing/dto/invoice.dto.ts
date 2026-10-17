import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
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
  ValidateNested,
} from 'class-validator';
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH } from '../billing.constants';
import { DiscountKind, InvoicePaymentStatus } from '../enums/billing.enums';
import {
  INVOICE_EDIT_OPS,
  InvoiceEditOp,
} from '../invoices/edit-operations/invoice-edit.types';
import { PageQueryDto, trim } from './config.dto';

export class CreateInvoiceDto {
  @IsUUID('4') patientId: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  chargeIds: string[];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) notes?: string;
}

/** One edit command; `op` decides which fields its handler requires (6.7). */
export class InvoiceEditOperationDto {
  @IsIn(INVOICE_EDIT_OPS) op: InvoiceEditOp;
  @IsOptional() @IsUUID('4') chargeId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  chargeIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(999) quantity?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unitPrice?: number;
  @IsOptional() @IsUUID('4') discountTypeId?: string;
  @IsOptional() @IsEnum(DiscountKind) kind?: DiscountKind;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) note?: string;
  @IsOptional() @IsUUID('4') serviceId?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string;
  @IsOptional() @IsUUID('4') doctorId?: string;
}

export class EditInvoicePreviewDto {
  @IsInt() @Min(1) expectedRevision: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceEditOperationDto)
  operations: InvoiceEditOperationDto[];
}

export class EditInvoiceDto extends EditInvoicePreviewDto {
  @Transform(trim)
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  reason: string;
}

const LIST_STATUSES = [
  ...Object.values(InvoicePaymentStatus),
  'REFUNDED',
  'CANCELLED',
] as const;

export class ListInvoicesQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(LIST_STATUSES)
  paymentStatus?: (typeof LIST_STATUSES)[number];
  @IsOptional() @IsUUID('4') patientId?: string;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) search?: string;
}

export class DateRangeQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
