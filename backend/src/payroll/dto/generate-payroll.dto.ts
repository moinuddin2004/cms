import { IsNumber, IsNotEmpty, Min, Max, IsUUID } from 'class-validator';

export class GeneratePayrollDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(2020)
  year: number;

  @IsUUID()
  @IsNotEmpty()
  locationId: string;
}
