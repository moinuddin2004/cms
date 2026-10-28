# Conflicts and oddities — Chapter 45

- Known issue confirmed: the Organizations form offers FREE, BASIC, PREMIUM, ENTERPRISE; the `SubscriptionPlan` enum is lowercase free/starter/professional/enterprise and the DTO uses `@IsEnum`. All four values fail validation; BASIC and PREMIUM are not plans. (By reading; app not run.)
- backend/docs/modules/01-organizations-locations.md matched the code on every point checked (14-day trial, 3 grace days, 30 s cache, exempt paths, 402 code).
- `email_verified_at` is written but never read by any gate; the banner uses the token column instead.
- Recording a payment overwrites the plan with the payment's plan.

## Security
- Category: authentication hardening. Minimum password length is short; register, verify and resend are rate limited.
- Category: audit. Plan changes through the legacy Organizations endpoint are not audited, unlike the Subscriptions endpoint.
- Category: configuration. The verification link base URL comes from an environment variable with a localhost fallback; a missing production value would send wrong links.
