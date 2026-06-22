import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '../enums/billing.enums';

export class RecordPaymentDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
