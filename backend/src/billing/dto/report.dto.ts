import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BillingAuditAction, BillingAuditEntity } from '../enums/billing.enums';
import { PageQueryDto, trim } from './config.dto';

export class CashCloseLineDto {
  @IsUUID('4') paymentAccountId: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) counted?: number;
}

export class CreateCashCloseDto {
  /** From the preview, so the count matches what staff saw. */
  @IsISO8601() periodEnd: string;
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CashCloseLineDto)
  lines: CashCloseLineDto[];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) note?: string;
}

export class ActivityQueryDto extends PageQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @IsOptional() @IsUUID('4') actorId?: string;
  @IsOptional() @IsEnum(BillingAuditEntity) entityType?: BillingAuditEntity;
  @IsOptional() @IsEnum(BillingAuditAction) action?: BillingAuditAction;
}

export class OutstandingQueryDto {
  /** Comma-separated patient ids (max 100). */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  patientIds: string[];
}

export class StatementQueryDto {
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}

export class PrintInvoiceQueryDto {
  @IsOptional() @Type(() => Number) @Min(1) revision?: number;
}
