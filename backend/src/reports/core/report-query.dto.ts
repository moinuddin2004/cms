import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { RevenueBasis } from './report.types';

export const REPORT_SCOPES = ['location', 'organization'] as const;
export type ReportScopeKind = (typeof REPORT_SCOPES)[number];

export const REVENUE_BASES: RevenueBasis[] = ['collected', 'billed'];

export const EXPORT_FORMATS = ['xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Filters every report and the finance overview accept. */
export class ReportQueryDto {
  /** Clinic-local `YYYY-MM-DD`; default = first day of this month. */
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  /** Clinic-local `YYYY-MM-DD`; default = today. */
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
  /** `organization` = every location (owners only). */
  @IsOptional() @IsIn(REPORT_SCOPES) scope?: ReportScopeKind;
  @IsOptional() @IsIn(REVENUE_BASES) basis?: RevenueBasis;
  @IsOptional() @IsUUID('4') doctorId?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
}

export class ReportExportQueryDto extends ReportQueryDto {
  @IsIn(EXPORT_FORMATS) format: ExportFormat;
}
