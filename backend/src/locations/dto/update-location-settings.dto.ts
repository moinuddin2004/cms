import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsArray, Min, Max } from 'class-validator';

export class UpdateLocationSettingsDto {
  @IsOptional() @IsInt() @Min(5) @Max(480) defaultSlotDuration?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) advanceBookingDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(168) cancellationNoticeHours?: number;
  @IsOptional() @IsInt() @Min(0) maxDailyAppointments?: number;
  @IsOptional() @IsBoolean() enableReminders?: boolean;
  @IsOptional() @IsInt() @Min(0) reminderBeforeHours?: number;
  @IsOptional() @IsInt() @Min(0) followUpAfterDays?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) reminderChannels?: string[];
  @IsOptional() @IsString() paymentGateway?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) lateFeePercentage?: number;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() theme?: string;
}
