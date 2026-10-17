import { Transform, Type } from 'class-transformer';
import {
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
import { PageQueryDto, trim } from './config.dto';
import { EditInvoiceDto } from './invoice.dto';

/** Refund body without the patient (invoice refunds take it from the invoice). */
export class RefundBodyDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsUUID('4') paymentAccountId: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  referenceNumber?: string;
  @Transform(trim)
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  reason: string;
  @IsUUID('4') clientRequestId: string;
}

/** POST /refunds — always an advance refund (6.10). */
export class CreateRefundDto extends RefundBodyDto {
  @IsUUID('4') patientId: string;
}

/** POST /invoices/:invoiceId/refund — optional edit + refund, atomic (6.18). */
export class InvoiceRefundDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => EditInvoiceDto)
  edit?: EditInvoiceDto;
  @ValidateNested() @Type(() => RefundBodyDto) refund: RefundBodyDto;
}

export class ListRefundsQueryDto extends PageQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsUUID('4') patientId?: string;
}
