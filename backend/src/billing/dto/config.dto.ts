import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_DUE_DAYS } from '../billing.constants';
import {
  PaymentMethod,
  PrintFormat,
  ServiceKind,
} from '../enums/billing.enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
/**
 * Query-string booleans. Reads the RAW value (`obj[key]`): the global
 * ValidationPipe's implicit conversion has already turned "false" into
 * `true` in `value` by the time this runs.
 */
const toBool = ({
  value,
  obj,
  key,
}: {
  value: unknown;
  obj: Record<string, unknown>;
  key: string;
}) => {
  const raw = obj[key] ?? value;
  if (raw === 'true' || raw === true) return true;
  if (raw === 'false' || raw === false) return false;
  return raw;
};

// ─── Catalog ────────────────────────────────────────────────────────

export class CreateServiceDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @Transform(upper) @IsString() @MaxLength(30) code?: string;
  @IsEnum(ServiceKind) kind: ServiceKind;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) defaultPrice: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateServiceDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
  @IsOptional() @Transform(upper) @IsString() @MaxLength(30) code?:
    | string
    | null;
  @IsOptional() @IsEnum(ServiceKind) kind?: ServiceKind;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultPrice?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class ListServicesQueryDto {
  @IsOptional() @Transform(toBool) @IsBoolean() activeOnly?: boolean;
  @IsOptional() @IsEnum(ServiceKind) kind?: ServiceKind;
}

export class ResolvedPriceQueryDto {
  @IsOptional() @IsUUID('4') doctorId?: string;
}

export class CreateServicePriceDto {
  @IsUUID('4') serviceId: string;
  @IsOptional() @IsUUID('4') doctorId?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
}

export class UpdateServicePriceDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
}

export class ListServicePricesQueryDto {
  @IsOptional() @IsUUID('4') serviceId?: string;
}

// ─── Settings ───────────────────────────────────────────────────────

export class UpdateBillingSettingsDto {
  @IsOptional()
  @Transform(upper)
  @Matches(/^[A-Z0-9]{2,6}$/, {
    message: 'Code must be 2–6 letters or digits',
  })
  documentCode?: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_DUE_DAYS) dueDays?: number;
  @IsOptional() @IsEnum(PrintFormat) invoicePrintFormat?: PrintFormat;
  @IsOptional() @IsEnum(PrintFormat) receiptPrintFormat?: PrintFormat;
  @IsOptional() @IsBoolean() showLogo?: boolean;
  @IsOptional() @IsBoolean() showPreviousBalance?: boolean;
  @IsOptional() @IsBoolean() showOutstandingAtCheckIn?: boolean;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) footerNote?:
    | string
    | null;
  @IsOptional() @IsUUID('4') defaultConsultationServiceId?: string | null;
  @IsOptional() @IsUUID('4') defaultPaymentAccountId?: string;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cashVarianceAlertAmount?: number;
}

// ─── Payment accounts ───────────────────────────────────────────────

export class CreatePaymentAccountDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name: string;
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) bankName?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  accountTitle?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  accountNumber?: string;
  @IsOptional() @IsBoolean() requiresReference?: boolean;
  @IsOptional() @IsBoolean() countedInCashClose?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdatePaymentAccountDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) bankName?:
    | string
    | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) accountTitle?:
    | string
    | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) accountNumber?:
    | string
    | null;
  @IsOptional() @IsBoolean() requiresReference?: boolean;
  @IsOptional() @IsBoolean() countedInCashClose?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class ListActiveQueryDto {
  @IsOptional() @Transform(toBool) @IsBoolean() activeOnly?: boolean;
}

// ─── Shared list queries ────────────────────────────────────────────

export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export { trim, upper, toBool };
