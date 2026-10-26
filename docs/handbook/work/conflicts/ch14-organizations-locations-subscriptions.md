# Conflicts and oddities — ch14-organizations-locations-subscriptions.md

## Oddities
- `organization_settings.feature_*` switches are not read by FeatureFlagGuard/AccessGuard; only `LocationSettingsFeature.tsx` uses them to hide sections. Two parallel feature-switch mechanisms.
- `locations` column defaults `timezone='UTC'`, `currency='USD'` differ from `organizations` defaults `Asia/Karachi`, `PKR`.
- `LocationsService.getSettings` auto-creates `location_settings` with only `locationId`, leaving `organization_id` null.
- `config_values` rows are not removed when their organization or location goes away (polymorphic, no FK).
- Hard delete of an organization would be blocked by RESTRICT FKs from lab, notification and engine tables; the app only soft-deletes, so this is theoretical.
