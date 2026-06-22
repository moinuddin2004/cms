import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateCreditPackageDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  totalCredits: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;
}

export class UpdateCreditPackageDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCredits?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PurchaseCreditDto {
  @IsUUID()
  creditPackageId: string;
}

export class UseCreditDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
