import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PayrollStatus } from '../enums/payroll.enums';

/**
 * Manually create a single payroll record for one employee — used when the
 * automatic month-end generation didn't cover someone (e.g. a newly added
 * employee) or a one-off adjustment is needed. `notes` records the reason.
 */
export class CreatePayrollDto {
  @IsNotEmpty()
  @IsUUID()
  employeeId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  year: number;

  @IsNumber()
  @Min(0)
  salaryAmount: number;

  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
