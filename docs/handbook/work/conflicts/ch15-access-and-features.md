# Conflicts and oddities — ch15-access-and-features.md

## Doc vs code
- **CLAUDE.md** says `organizations/` owns "employee role definitions". **Code:** `EmploymentRole` is in `employees/entities/`; registered by employees, access and feature-flags modules; permission logic in `access/`. Evidence: ENTITY_CATALOG §9; module files.

## Oddities
- `org_feature_flags.feature_key` and `location_feature_overrides.feature_key` are free text copies of `feature_catalog.key`, no FK.
- `location_feature_overrides.organization_id` has no FK while `location_id` has one.
- `nav_layouts.role_id` supports per-role layouts but the entity comment says only the default kind is written in v1.
