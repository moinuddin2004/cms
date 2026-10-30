import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsArray, Min, Max } from 'class-validator';

// Field names must match LocationSettings columns: the service merges the
// body straight onto the entity, so any other name is silently dropped.
export class UpdateLocationSettingsDto {
  @IsOptional() @IsInt() @Min(5) @Max(480) appointmentSlotDuration?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) advanceBookingDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(168) cancellationNoticeHours?: number;
  @IsOptional() @IsInt() @Min(0) maxAppointmentsPerDay?: number;
  @IsOptional() @IsBoolean() reminderEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) reminderDaysBefore?: number;
  @IsOptional() @IsInt() @Min(0) reminderHoursBefore?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) reminderChannels?: string[];
  @IsOptional() @IsString() paymentGateway?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) lateFeePercentage?: number;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() theme?: string;
}
