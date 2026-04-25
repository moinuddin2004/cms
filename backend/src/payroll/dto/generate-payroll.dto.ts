import { IsInt, IsNotEmpty, Min, Max } from 'class-validator';

export class GeneratePayrollDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @IsNotEmpty()
  @Min(2020)
  year: number;
}
