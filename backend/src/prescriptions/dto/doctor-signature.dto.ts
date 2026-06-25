import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class SaveDoctorSignatureDto {
  /** Either a public URL or a `data:image/...;base64,…` payload. */
  @IsString()
  @IsNotEmpty()
  signatureImageUrl: string;

  @IsOptional()
  @IsString()
  signatureData?: string;
}
