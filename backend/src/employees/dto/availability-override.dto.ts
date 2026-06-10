import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OverrideHoursSlotDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:MM format',
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:MM format',
  })
  endTime: string;
}

export class CreateAvailabilityOverrideDto {
  @IsDateString()
  date: string;

  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OverrideHoursSlotDto)
  overrideHours?: OverrideHoursSlotDto[];
}

export class UpdateAvailabilityOverrideDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OverrideHoursSlotDto)
  overrideHours?: OverrideHoursSlotDto[];
}

export class OverrideFilterDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
