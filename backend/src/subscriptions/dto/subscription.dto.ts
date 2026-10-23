import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';
import {
  SUBSCRIPTION_PAYMENT_METHODS,
  SubscriptionPaymentMethod,
} from '../entities/subscription-payment.entity';

export class RecordSubscriptionPaymentDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsInt()
  @Min(1)
  @Max(36)
  months: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsIn(SUBSCRIPTION_PAYMENT_METHODS)
  method: SubscriptionPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  /** ISO date-time, or null to clear. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  trialEndsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  paidUntil?: string | null;

  /** null = use the plan's limit. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  maxLocations?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  maxUsers?: number | null;
}

export class PaymentInstructionsDto {
  @IsString()
  @MaxLength(2000)
  text: string;
}

/** Clinic types the org's `specialtyTags` may hold. */
export const CLINIC_SPECIALTIES = [
  'general',
  'dental',
  'skin',
  'ortho',
  'physio',
  'eye',
] as const;

export class SetupClinicDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @IsArray()
  @ArrayMaxSize(CLINIC_SPECIALTIES.length)
  @IsIn(CLINIC_SPECIALTIES, { each: true })
  specialtyTags: string[];

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  timezone: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(10)
  currency: string;
}

export class SetupLocationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate: number;
}
