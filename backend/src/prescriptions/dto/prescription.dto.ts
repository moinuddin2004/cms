import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MealRelation } from '../enums/meal-relation.enum';
import { PrescriptionStatus } from '../enums/prescription-status.enum';

export class PrescriptionMedicineDto {
  @IsOptional()
  @IsUUID()
  medicineDirectoryId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  medicineName: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  medicineNameUrdu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  type?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dosage: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  frequency: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  frequencyTiming?: string[];

  @IsOptional()
  @IsEnum(MealRelation)
  mealRelation?: MealRelation;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  duration: string;

  @IsOptional()
  @IsString()
  specialInstructions?: string;

  @IsOptional()
  @IsString()
  specialInstructionsUrdu?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreatePrescriptionDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  /** The consultation (encounter) this prescription belongs to. */
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  /** Employee UUID of the prescribing doctor. Optional until UI exposes a picker. */
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  prescriptionTemplateId?: string;

  /** When set, the service pre-fills medicines + instructions from the template. */
  @IsOptional()
  @IsUUID()
  treatmentPlanTemplateId?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  furtherPlan?: string;

  @IsOptional()
  @IsString()
  instructionsEnglish?: string;

  @IsOptional()
  @IsString()
  instructionsUrdu?: string;

  @IsOptional()
  @IsObject()
  vitals?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines?: PrescriptionMedicineDto[];
}

export class UpdatePrescriptionDto {
  @IsOptional()
  @IsUUID()
  prescriptionTemplateId?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  furtherPlan?: string;

  @IsOptional()
  @IsString()
  instructionsEnglish?: string;

  @IsOptional()
  @IsString()
  instructionsUrdu?: string;

  @IsOptional()
  @IsObject()
  vitals?: Record<string, any>;

  /**
   * If provided, the service DELETES old medicines and INSERTS the new set.
   * Editing a FINALIZED prescription triggers AMENDED status + version bump.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  medicines?: PrescriptionMedicineDto[];

  @IsOptional()
  @IsString()
  changeNotes?: string;
}

export class AddMedicineDto extends PrescriptionMedicineDto {}

export class FinalizePrescriptionDto {
  /** Override the doctor's saved signature with a one-off image URL. */
  @IsOptional()
  @IsString()
  signatureImageUrl?: string;

  @IsOptional()
  @IsString()
  changeNotes?: string;
}

export class PrescriptionFilterDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
