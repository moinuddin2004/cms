import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  LabInvoiceLineKind,
  LabInvoiceStatus,
  LabPaymentMethod,
  LabPaymentStatus,
} from '../enums/lab-billing.enums';

const MAX_MINOR = 1_000_000_000_00; // PKR 1 billion

export class InvoiceLineDto {
  @IsEnum(LabInvoiceLineKind)
  kind: LabInvoiceLineKind;

  /** lab_item */
  @IsOptional()
  @IsUUID()
  itemId?: string;

  /** lab_charge */
  @IsOptional()
  @IsUUID()
  chargeRequestId?: string;

  /** manual (required), lab_charge (optional override). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  /**
   * manual (required), lab_charge (default: the lab's charge). lab_item:
   * optional override of the frozen patient price — then the WHOLE line price
   * (not per unit); omit it to bill the frozen price.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MINOR)
  unitPriceMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MINOR)
  discountMinor?: number;
}

class InvoiceBodyBase {
  /** Omit with `orderId` = every unbilled item of the order. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];

  /** Invoice-level discount, spread over the lines (replaces line discounts). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MINOR)
  discountMinor?: number;

  /** Every line's tax rate; default = the clinic's lab billing setting. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  taxRateBp?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateInvoiceDto extends InvoiceBodyBase {
  @IsOptional()
  @IsUUID()
  orderId?: string;

  /** Required without `orderId`. */
  @IsOptional()
  @IsUUID()
  patientId?: string;

  /** Issue straight away (default: save as an estimate). */
  @IsOptional()
  @IsBoolean()
  issue?: boolean;
}

export class UpdateInvoiceDto extends InvoiceBodyBase {
  @IsInt()
  version: number;
}

export class IssueInvoiceDto {
  @IsInt()
  version: number;

  /** Use the patient's advance on this invoice (default true). */
  @IsOptional()
  @IsBoolean()
  applyAdvance?: boolean;
}

export class VoidInvoiceDto {
  @IsInt()
  version: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class AllocationDto {
  @IsUUID()
  invoiceId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_MINOR)
  amountMinor: number;
}

export class CollectPaymentDto {
  @IsUUID()
  patientId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_MINOR)
  amountMinor: number;

  @IsEnum(LabPaymentMethod)
  method: LabPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Where the money goes; omitted = oldest open invoices first. Remainder = advance. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations?: AllocationDto[];

  /** false + no allocations = the whole amount is advance. Default true. */
  @IsOptional()
  @IsBoolean()
  autoAllocate?: boolean;
}

export class ApplyAdvanceDto {
  /** Default: as much as the advance and the balance allow. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_MINOR)
  amountMinor?: number;
}

export class ReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class CreditNoteDto extends ReasonDto {
  @IsInt()
  @Min(1)
  @Max(MAX_MINOR)
  amountMinor: number;
}

export class RefundDto extends ReasonDto {
  @IsUUID()
  patientId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_MINOR)
  amountMinor: number;

  @IsEnum(LabPaymentMethod)
  method: LabPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @IsOptional()
  @IsUUID()
  creditNoteId?: string;
}

export class SettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  taxRateBp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  dueDays?: number;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @Matches(YMD)
  from?: string;

  @IsOptional()
  @Matches(YMD)
  to?: string;
}

export class ListInvoicesQueryDto extends PageQuery {
  /** A stored status, or `overdue` (issued/partly paid, past due). */
  @IsOptional()
  @IsIn([...Object.values(LabInvoiceStatus), 'overdue'])
  status?: LabInvoiceStatus | 'overdue';

  @IsOptional()
  @IsUUID()
  orderId?: string;
}

export class ListPaymentsQueryDto extends PageQuery {
  @IsOptional()
  @IsEnum(LabPaymentStatus)
  status?: LabPaymentStatus;

  @IsOptional()
  @IsEnum(LabPaymentMethod)
  method?: LabPaymentMethod;
}
