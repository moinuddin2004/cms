import { IsNotEmpty, IsUUID } from 'class-validator';

export class SelectLocationRequestDto {
  @IsNotEmpty()
  @IsUUID()
  organizationId: string;

  @IsNotEmpty()
  @IsUUID()
  locationId: string;
}
