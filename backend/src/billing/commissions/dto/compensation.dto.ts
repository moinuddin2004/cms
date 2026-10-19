import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ServiceKind } from '../../enums/billing.enums';
import {
  CommissionBasis,
  CompensationPlanType,
  MAX_RATE_BPS,
} from '../commission.enums';

/** Money is integer paisa and rates are integer basis points (no floats). */
export class CommissionRuleDto {
  /** A rule targets one catalog service OR one service category. */
  @IsOptional() @IsUUID('4') serviceId?: string;
  @IsOptional() @IsEnum(ServiceKind) serviceCategory?: ServiceKind;
  /** Exactly one of rateBps / fixedAmountPaisa. */
  @IsOptional() @IsInt() @Min(0) @Max(MAX_RATE_BPS) rateBps?: number;
  @IsOptional() @IsInt() @Min(0) fixedAmountPaisa?: number;
}

export class CompensationPlanDto {
  @IsEnum(CompensationPlanType) type: CompensationPlanType;
  @IsOptional() @IsInt() @Min(0) baseSalaryPaisa?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_RATE_BPS) defaultRateBps?: number;
  @IsOptional() @IsEnum(CommissionBasis) commissionBasis?: CommissionBasis;
  /** Clinic date the version starts; default: today at the location. */
  @IsOptional() @IsISO8601({ strict: true }) effectiveFrom?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CommissionRuleDto)
  rules?: CommissionRuleDto[];
}

export class ReplaceCommissionRulesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CommissionRuleDto)
  rules: CommissionRuleDto[];
}

export class CommissionsQueryDto {
  @IsOptional() @IsUUID('4') assignmentId?: string;
  @IsOptional() @IsUUID('4') locationId?: string;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}

export class EarningsQueryDto {
  @IsOptional() @IsUUID('4') locationId?: string;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
