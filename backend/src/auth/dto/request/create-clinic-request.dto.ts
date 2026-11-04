import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** A signed-in user with no clinic creates one (awaits approval). */
export class CreateClinicRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  clinicName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
