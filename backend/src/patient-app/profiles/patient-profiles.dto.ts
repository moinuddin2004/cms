import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import type {
  PatientProfileGender,
  PatientProfileRelation,
} from '../entities/patient-profile.entity';
import type {
  ClinicRefDto,
  LocationRefDto,
} from '../reads/patient-reads.types';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Relations a family member can have. `self` is created by sign-up / the first claim only. */
export const FAMILY_RELATIONS = ['child', 'parent', 'spouse', 'other'] as const;
export const GENDERS = ['male', 'female', 'other'] as const;

/** `YYYY-MM-DD`, a real calendar day, not in the future. */
@ValidatorConstraint({ name: 'isPastCalendarDate', async: false })
export class IsPastCalendarDate implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return false;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(Date.UTC(y, mo - 1, d));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== mo - 1 ||
      date.getUTCDate() !== d
    ) {
      return false;
    }
    return y >= 1900 && date.getTime() <= Date.now();
  }
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a past date (YYYY-MM-DD)`;
  }
}

export class CreateProfileDto {
  @IsIn(FAMILY_RELATIONS)
  relation: (typeof FAMILY_RELATIONS)[number];

  @Transform(trim)
  @IsString()
  @Length(1, 150)
  fullName: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @Validate(IsPastCalendarDate)
  dob?: string;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: PatientProfileGender;
}

/** `null` clears `dob` / `gender`; an omitted key leaves the value alone. */
export class UpdateProfileDto {
  @IsOptional()
  @IsIn(FAMILY_RELATIONS)
  relation?: (typeof FAMILY_RELATIONS)[number];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  fullName?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @Validate(IsPastCalendarDate)
  dob?: string | null;

  @IsOptional()
  @IsIn(GENDERS)
  gender?: PatientProfileGender | null;
}

export interface ProfileLinkDto {
  id: string;
  clinic: ClinicRefDto;
  location: LocationRefDto | null;
  status: 'active' | 'frozen';
  linkedAt: string;
}

/** Explicit response shape of `/patient-api/profiles`. */
export interface PatientProfileDto {
  id: string;
  relation: PatientProfileRelation;
  fullName: string;
  dob: string | null;
  gender: PatientProfileGender | null;
  isSelf: boolean;
  links: ProfileLinkDto[];
}
