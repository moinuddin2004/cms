import { IsBoolean } from 'class-validator';

export class TogglePortalAccessDto {
  @IsBoolean()
  hasPortalAccess: boolean;
}
