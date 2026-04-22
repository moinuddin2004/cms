import {
  IsNumber,
  IsNotEmpty,
  Min,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

export class SetSalaryDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  grossSalary: number;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
