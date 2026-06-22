import { IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsOptional() @IsBoolean() featureAppointments?: boolean;
  @IsOptional() @IsBoolean() featureInventory?: boolean;
  @IsOptional() @IsBoolean() featureFinance?: boolean;
  @IsOptional() @IsBoolean() featureReminders?: boolean;
  @IsOptional() @IsBoolean() featureWhatsapp?: boolean;
  @IsOptional() @IsBoolean() featurePatientPortal?: boolean;
  @IsOptional() @IsBoolean() allowLocationOverride?: boolean;
  @IsOptional() @IsInt() @Min(5) @Max(480) defaultSlotDuration?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) advanceBookingDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(168) cancellationNoticeHours?: number;
}
