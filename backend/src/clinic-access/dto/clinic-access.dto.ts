import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateSignInPolicyDto {
  @IsBoolean()
  googleEnabled: boolean;

  @IsBoolean()
  requireGoogle: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  googleDomains: string[];

  @IsBoolean()
  joinRequestsEnabled: boolean;
}

export class ClinicApprovalDecisionDto {
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  /** Shown to the owner when rejected. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ApproveJoinRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  designation: string;

  @IsOptional()
  @IsUUID()
  employmentRoleId?: string;
}

export class RejectJoinRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
