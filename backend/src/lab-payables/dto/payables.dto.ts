import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  BillLineKind,
  StatementStatus,
  VendorBillStatus,
  VendorPaymentMethod,
} from '../enums/payables.enums';

/** Paisa amounts are whole numbers within JS's exact range. */
const MAX_PAISA = 1_000_000_000_000;

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class BillsQueryDto extends PageQueryDto {
  @IsOptional() @IsEnum(VendorBillStatus) status?: VendorBillStatus;
  @IsOptional() @IsUUID() labId?: string;
  @IsOptional() @IsUUID() labOrderId?: string;
  @IsOptional() @IsString() @MaxLength(60) search?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  /** Only bills with something left to pay. */
  @IsOptional() @IsIn(['true', 'false']) open?: 'true' | 'false';
}

export class VersionDto {
  @Type(() => Number) @IsInt() @Min(1) version: number;
}

export class UpdateBillDto extends VersionDto {
  @IsOptional() @IsString() @MaxLength(60) vendorInvoiceNo?: string | null;
  @IsOptional() @IsDateString() billDate?: string;
  @IsOptional() @IsDateString() dueOn?: string | null;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  taxBp?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
}

export class AddBillLineDto extends VersionDto {
  @IsEnum(BillLineKind) kind: BillLineKind;
  @IsString() @MinLength(1) @MaxLength(300) description: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10_000) quantity: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_PAISA) unitCostPaisa: number;
}

export class ApproveBillDto extends VersionDto {
  @IsOptional() @IsString() @MaxLength(60) vendorInvoiceNo?: string;
  @IsOptional() @IsDateString() dueOn?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  taxBp?: number;
}

export class ReasonVersionDto extends VersionDto {
  @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

export class AllocationDto {
  @IsUUID() billId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAISA) amountPaisa: number;
}

export class CreatePaymentDto {
  @IsUUID() labId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAISA) amountPaisa: number;
  @IsEnum(VendorPaymentMethod) method: VendorPaymentMethod;
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
  @IsOptional() @IsDateString() paidOn?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations: AllocationDto[];
}

export class AllocatePaymentDto extends VersionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations: AllocationDto[];
}

export class PaymentsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() labId?: string;
}

export class StatementLineDto {
  @IsOptional() @IsString() @MaxLength(60) labReference?: string;
  @IsOptional() @IsDateString() lineDate?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_PAISA) amountPaisa: number;
}

export class CreateStatementDto {
  @IsUUID() labId: string;
  @IsDateString() periodStart: string;
  @IsDateString() periodEnd: string;
  @IsOptional() @IsString() @MaxLength(60) statementRef?: string;
  /** Defaults to Σ lines. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PAISA)
  totalPaisa?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => StatementLineDto)
  lines: StatementLineDto[];
}

export class StatementStatusDto extends VersionDto {
  @IsIn([StatementStatus.RECONCILED, StatementStatus.DISPUTED])
  status: StatementStatus.RECONCILED | StatementStatus.DISPUTED;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class StatementsQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() labId?: string;
  @IsOptional() @IsEnum(StatementStatus) status?: StatementStatus;
}

export class AgingQueryDto {
  @IsOptional() @IsUUID() labId?: string;
}

export class MonthlyCostQueryDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
}

export class CaseProfitQueryDto extends PageQueryDto {
  @IsOptional() @IsUUID() labId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
