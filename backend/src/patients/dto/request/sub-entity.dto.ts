import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsInt,
  IsNumber,
  IsArray,
  IsObject,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GumCondition } from '../../enums/gum-condition.enum';
import { BrushingFrequency } from '../../enums/brushing-frequency.enum';
import { FlossingFrequency } from '../../enums/flossing-frequency.enum';
import { DocumentType } from '../../enums/document-type.enum';
import { ConsentType } from '../../enums/consent-type.enum';
import { CommType } from '../../enums/comm-type.enum';
import { CommDirection } from '../../enums/comm-direction.enum';
import { CommStatus } from '../../enums/comm-status.enum';
import { CommPurpose } from '../../enums/comm-purpose.enum';
import { RecallType } from '../../enums/recall-type.enum';
import { RecallStatus } from '../../enums/recall-status.enum';
import { ReferralStatus } from '../../enums/referral-status.enum';
import { FeedbackCategory } from '../../enums/feedback-category.enum';

// ─── Dental Info ──────────────────────────────────────────

export class UpsertDentalInfoDto {
  @IsOptional() @IsDateString() lastDentalCheckup?: string;
  @IsOptional() @IsString() teethConditionNotes?: string;
  @IsOptional() @IsEnum(GumCondition) gumCondition?: GumCondition;
  @IsOptional() @IsBoolean() teethSensitivity?: boolean;
  @IsOptional() @IsString() sensitivityNotes?: string;
  @IsOptional() @IsEnum(BrushingFrequency) brushingFrequency?: BrushingFrequency;
  @IsOptional() @IsEnum(FlossingFrequency) flossingFrequency?: FlossingFrequency;
  @IsOptional() @IsBoolean() smokingStatus?: boolean;
  @IsOptional() @IsBoolean() tobaccoChewing?: boolean;
  @IsOptional() @IsBoolean() orthodonticHistory?: boolean;
  @IsOptional() @IsString() orthodonticNotes?: string;
  @IsOptional() @IsString() prostheticsInfo?: string;
  @IsOptional() @IsString() previousExtractions?: string;
  @IsOptional() @IsString() previousSurgeries?: string;
  @IsOptional() @IsString() xrayNotes?: string;
  @IsOptional() @IsString() dentistNotes?: string;
}

// ─── Teeth Chart ──────────────────────────────────────────

export class CreateTeethChartDto {
  @IsNotEmpty() @IsUUID() dentistId: string;
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsNotEmpty() @IsObject() chartData: Record<string, any>;
  @IsOptional() @IsObject() periodontalChart?: Record<string, any>;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isInitialChart?: boolean;
}

// ─── Vitals ───────────────────────────────────────────────

export class CreateVitalsDto {
  @IsNotEmpty() @IsUUID() recordedBy: string;
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsOptional() @IsInt() bpSystolic?: number;
  @IsOptional() @IsInt() bpDiastolic?: number;
  @IsOptional() @IsInt() pulseRate?: number;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsInt() oxygenSaturation?: number;
  @IsOptional() @IsNumber() weightKg?: number;
  @IsOptional() @IsNumber() heightCm?: number;
  @IsOptional() @IsBoolean() isDiabetic?: boolean;
  @IsOptional() @IsBoolean() isHypertensive?: boolean;
  @IsOptional() @IsBoolean() isPregnant?: boolean;
  @IsOptional() @IsBoolean() isOnBloodThinners?: boolean;
  @IsOptional() @IsBoolean() isOnAntibiotics?: boolean;
  @IsOptional() @IsString() anesthesiaType?: string;
  @IsOptional() @IsString() anesthesiaDose?: string;
  @IsOptional() @IsUUID() anesthesiaAdministeredBy?: string;
  @IsOptional() @IsString() notes?: string;
}

// ─── Prescriptions ────────────────────────────────────────

export class CreatePrescriptionDto {
  @IsNotEmpty() @IsUUID() prescribedBy: string;
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsOptional() @IsString() chiefComplaint?: string;
  @IsOptional() @IsString() diagnosis?: string;
  @IsNotEmpty() @IsArray() medications: Record<string, any>[];
  @IsOptional() @IsString() specialInstructions?: string;
  @IsOptional() @IsDateString() followUpDate?: string;
}

// ─── Documents ────────────────────────────────────────────

export class CreateDocumentDto {
  @IsNotEmpty() @IsEnum(DocumentType) documentType: DocumentType;
  @IsNotEmpty() @IsString() @MaxLength(255) fileName: string;
  @IsNotEmpty() @IsString() fileUrl: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsInt() fileSizeBytes?: number;
  @IsOptional() @IsString() @MaxLength(100) mimeType?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() @MaxLength(10) toothNumber?: string;
  @IsOptional() @IsDateString() takenDate?: string;
  @IsOptional() @IsBoolean() isVisibleToPatient?: boolean;
  @IsNotEmpty() @IsUUID() uploadedBy: string;
  @IsOptional() @IsUUID() appointmentId?: string;
}

// ─── Consents (Immutable) ─────────────────────────────────

export class CreateConsentDto {
  @IsNotEmpty() @IsEnum(ConsentType) consentType: ConsentType;
  @IsOptional() @IsString() @MaxLength(20) consentVersion?: string;
  @IsNotEmpty() @IsString() consentText: string;
  @IsNotEmpty() @IsBoolean() isAgreed: boolean;
  @IsNotEmpty() @IsString() @MaxLength(150) signedByName: string;
  @IsOptional() @IsString() @MaxLength(20) signedByType?: string;
  @IsOptional() @IsUUID() witnessedBy?: string;
  @IsOptional() @IsString() signatureUrl?: string;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsUUID() appointmentId?: string;
}

// ─── Communications ───────────────────────────────────────

export class CreateCommunicationDto {
  @IsNotEmpty() @IsEnum(CommType) type: CommType;
  @IsNotEmpty() @IsEnum(CommDirection) direction: CommDirection;
  @IsOptional() @IsEnum(CommPurpose) purpose?: CommPurpose;
  @IsOptional() @IsString() @MaxLength(300) subject?: string;
  @IsOptional() @IsString() messageBody?: string;
  @IsOptional() @IsEnum(CommStatus) status?: CommStatus;
  @IsOptional() @IsUUID() sentBy?: string;
  @IsOptional() @IsBoolean() isAutomated?: boolean;
  @IsOptional() @IsString() automationTrigger?: string;
  @IsOptional() @IsUUID() appointmentId?: string;
}

// ─── Recalls ──────────────────────────────────────────────

export class CreateRecallDto {
  @IsNotEmpty() @IsEnum(RecallType) recallType: RecallType;
  @IsOptional() @IsString() @MaxLength(200) customName?: string;
  @IsNotEmpty() @IsDateString() dueDate: string;
  @IsOptional() @IsUUID() dentistId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateRecallDto {
  @IsOptional() @IsEnum(RecallStatus) status?: RecallStatus;
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsOptional() @IsString() notes?: string;
}

// ─── Referrals ────────────────────────────────────────────

export class CreateReferralDto {
  @IsOptional() @IsUUID() referredPatientId?: string;
  @IsOptional() @IsString() @MaxLength(150) referredName?: string;
  @IsOptional() @IsString() @MaxLength(20) referredPhone?: string;
  @IsOptional() @IsString() notes?: string;
}

// ─── Feedback ─────────────────────────────────────────────

export class CreateFeedbackDto {
  @IsNotEmpty() @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsEnum(FeedbackCategory) category?: FeedbackCategory;
  @IsOptional() @IsString() feedbackText?: string;
  @IsOptional() @IsBoolean() isAnonymous?: boolean;
  @IsOptional() @IsUUID() appointmentId?: string;
  @IsOptional() @IsUUID() dentistId?: string;
}

// ─── Insurance ────────────────────────────────────────────

export class CreateInsuranceDto {
  @IsNotEmpty() @IsString() @MaxLength(150) providerName: string;
  @IsOptional() @IsString() @MaxLength(150) planName?: string;
  @IsNotEmpty() @IsString() @MaxLength(100) policyNumber: string;
  @IsOptional() @IsString() @MaxLength(150) policyHolderName?: string;
  @IsOptional() @IsString() @MaxLength(100) groupNumber?: string;
  @IsOptional() @IsString() coverageDetails?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) coveragePercentage?: number;
  @IsOptional() @IsNumber() maxAnnualBenefit?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() cardFrontUrl?: string;
  @IsOptional() @IsString() cardBackUrl?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateInsuranceDto {
  @IsOptional() @IsString() @MaxLength(150) providerName?: string;
  @IsOptional() @IsString() @MaxLength(150) planName?: string;
  @IsOptional() @IsString() @MaxLength(100) policyNumber?: string;
  @IsOptional() @IsString() @MaxLength(150) policyHolderName?: string;
  @IsOptional() @IsString() @MaxLength(100) groupNumber?: string;
  @IsOptional() @IsString() coverageDetails?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) coveragePercentage?: number;
  @IsOptional() @IsNumber() maxAnnualBenefit?: number;
  @IsOptional() @IsNumber() usedBenefit?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() cardFrontUrl?: string;
  @IsOptional() @IsString() cardBackUrl?: string;
  @IsOptional() @IsString() notes?: string;
}
