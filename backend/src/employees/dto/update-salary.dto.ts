import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class UpdateSalaryDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  grossSalary: number;
}
