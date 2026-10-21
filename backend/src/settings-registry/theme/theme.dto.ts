import { IsObject, IsOptional } from 'class-validator';

/**
 * Theme writes, keyed by the short key (`app_name`, `brand_color`, …).
 * A value of null clears it (inherit from the scope above). Values are
 * validated by the registry schema of each key.
 */
export class UpdateThemeDto {
  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;

  /** Per-key lock for the scopes below (org: locations, platform: orgs). */
  @IsOptional()
  @IsObject()
  locks?: Record<string, boolean>;
}

/** Location overrides take values only — a location can't lock. */
export class UpdateLocationThemeDto {
  @IsObject()
  values: Record<string, unknown>;
}
