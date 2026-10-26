# Glossary — ch14-organizations-locations-subscriptions.md

- **organizations** — Organization: one clinic business, the tenant root.
- **organization_ownership** — Owner link between a user and an organization.
- **organization_settings** — Organization-wide booking defaults and older feature switches.
- **locations** — Location: one branch of an organization.
- **location_settings** — Per-location booking, reminder, tax and branding settings.
- **subscription_payments** — Subscription payment recorded by a super admin; extends `organizations.paid_until`.
- **config_values** — Settings registry value: one setting key at platform, organization or location scope.
- **Unmanaged clinic** — An organization with both `trial_ends_at` and `paid_until` null; it has no subscription expiry.
- **Settings registry** — The generic cascading settings store in `config_values` (platform, then organization, then location, with locks).
- **Setting lock** — `config_values.is_locked`: freezes the effective value so lower scopes cannot override it.
