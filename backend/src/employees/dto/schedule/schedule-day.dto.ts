import {
  IsInt,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class ScheduleDayDto {
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsBoolean()
  @IsNotEmpty()
  isWorking: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:MM format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:MM format',
  })
  endTime?: string;
}
