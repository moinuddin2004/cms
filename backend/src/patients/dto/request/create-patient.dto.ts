import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsArray,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Gender } from '../../enums/gender.enum';
import { BloodGroup } from '../../enums/blood-group.enum';

export class CreatePatientDto {
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  @MaxLength(255)
  fullName: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be one of: male, female, other' })
  gender?: Gender;

  @IsOptional()
  @IsEnum(BloodGroup, { message: 'Invalid blood group' })
  bloodGroup?: BloodGroup;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  emergencyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyRelation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  referredBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  occupation?: string;
}
