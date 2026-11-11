import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class UpdatePatientMeDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 150)
  fullName: string;
}

/** Explicit response shape of `/patient-api/me`. */
export interface PatientMeDto {
  id: string;
  fullName: string | null;
  email: string;
  createdAt: Date;
}
