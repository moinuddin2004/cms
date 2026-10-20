import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MagicLinkDelivery,
  MagicLinkPurpose,
} from '../entities/magic-link.entity';
import { MAX_TTL_HOURS } from '../magic-links/magic-link-token';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

class OptionalVersionDto {
  /** The order's version (If-Match); stale → 409. */
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class AcceptOrderDto extends OptionalVersionDto {
  @Matches(YMD, { message: 'labExpectedOn must be YYYY-MM-DD' })
  labExpectedOn: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectOrderDto extends OptionalVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class ClarificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;
}

export class ExpectedDateDto extends OptionalVersionDto {
  @Matches(YMD, { message: 'labExpectedOn must be YYYY-MM-DD' })
  labExpectedOn: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class IssueMagicLinkDto {
  /** `notification` (default): sent to the lab through the outbox; `copy`: the URL comes back once. */
  @IsOptional()
  @IsEnum(MagicLinkDelivery)
  delivery?: MagicLinkDelivery;

  @IsOptional()
  @IsEnum([MagicLinkPurpose.LAB_VIEW_ORDER, MagicLinkPurpose.LAB_UPDATE_ORDER])
  purpose?: MagicLinkPurpose;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_TTL_HOURS)
  expiresInHours?: number;
}
