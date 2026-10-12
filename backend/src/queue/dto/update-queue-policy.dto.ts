import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { RejoinPolicy } from '../enums/queue.enums';

export class UpdateQueuePolicyDto {
  /** Which row to write: this location's override, or the organization default. */
  @IsIn(['location', 'organization'])
  scope: 'location' | 'organization';

  /** Optimistic lock: the version you loaded (409 if someone saved since). */
  @IsInt()
  @IsOptional()
  version?: number;

  @IsBoolean()
  @IsOptional()
  smartQueueEnabled?: boolean;

  @IsInt()
  @Min(0)
  @Max(240)
  @IsOptional()
  earlyWindowMin?: number;

  @IsInt()
  @Min(0)
  @Max(240)
  @IsOptional()
  lateGraceMin?: number;

  @IsInt()
  @Min(0)
  @Max(480)
  @IsOptional()
  maxLateMin?: number;

  @IsInt()
  @Min(1)
  @Max(480)
  @IsOptional()
  walkinStarvationMin?: number;

  @IsEnum(RejoinPolicy)
  @IsOptional()
  skippedRejoinPolicy?: RejoinPolicy;

  /** null switches auto-skip off; otherwise at least 30 seconds. */
  @ValidateIf(
    (o: UpdateQueuePolicyDto) =>
      o.callTimeoutSec !== null && o.callTimeoutSec !== undefined,
  )
  @IsInt()
  @Min(30)
  @Max(3600)
  callTimeoutSec?: number | null;

  @IsBoolean()
  @IsOptional()
  manualSelectReasonRequired?: boolean;

  /** "HH:MM" local time a service day starts. */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  serviceDayCutoff?: string;
}
