import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ALL_AUDIENCES,
  ALL_CHANNELS,
  ALL_LANGUAGES,
  ALL_OUTBOX_STATUSES,
  NotificationAudience,
  NotificationChannel,
  NotificationLanguage,
  OutboxStatus,
} from '../notifications.enums';

/** Trims strings; blank becomes null so optional fields can be cleared. */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'Use 24-hour HH:MM';

export class UpdateAudienceSettingDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /** null clears quiet hours (send with quietEnd: null). */
  @IsOptional()
  @Transform(trimToNull)
  @Matches(TIME, { message: TIME_MESSAGE })
  quietStart?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @Matches(TIME, { message: TIME_MESSAGE })
  quietEnd?: string | null;

  /** IANA zone; null = the location's. */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(64)
  timezone?: string | null;
}

export class RuleChangeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventCode: string;

  @IsIn(ALL_AUDIENCES)
  audience: NotificationAudience;

  @IsIn(ALL_CHANNELS)
  channel: NotificationChannel;

  @IsBoolean()
  isEnabled: boolean;
}

export class UpdateRulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RuleChangeDto)
  rules: RuleChangeDto[];
}

export class TemplateQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventCode?: string;
}

export class UpsertTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventCode: string;

  @IsIn(ALL_CHANNELS)
  channel: NotificationChannel;

  @IsIn(ALL_LANGUAGES)
  language: NotificationLanguage;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  subject?: string | null;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  providerTemplateRef?: string | null;
}

export class OutboxLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(ALL_OUTBOX_STATUSES)
  status?: OutboxStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventCode?: string;

  @IsOptional()
  @IsIn(ALL_CHANNELS)
  channel?: NotificationChannel;

  @IsOptional()
  @IsIn(ALL_AUDIENCES)
  audience?: NotificationAudience;

  /** Recipient name, phone / email, or message text. */
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(100)
  search?: string | null;
}

export class UpdatePatientCommPrefsDto {
  @IsOptional()
  @IsBoolean()
  whatsappOptOut?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOptOut?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOptOut?: boolean;

  @IsOptional()
  @Transform(trimToNull)
  @IsIn([...ALL_LANGUAGES, null])
  preferredLanguage?: NotificationLanguage | null;
}

export class MyNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  unreadOnly?: boolean;
}

/** The signed-in user's own notification switches. Omitted = unchanged. */
export class UpdateMyNotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  sound?: boolean;

  /** Per-event email switches: `{ "appointment.booked": false }` (checked in the service). */
  @IsOptional()
  @IsObject()
  email?: Record<string, boolean>;
}
