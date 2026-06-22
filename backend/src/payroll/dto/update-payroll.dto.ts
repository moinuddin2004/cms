import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PayrollStatus } from '../enums/payroll.enums';

/**
 * Edit an existing payroll record (amount, period, status, or notes).
 */
export class UpdatePayrollDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2020)
  year?: number;

  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
