# Conflicts: ch56-authentication

## Doc vs code
- Doc: ch08 section 8.6 says the refresh cookie is valid for 7 days. Code: 1 day, or 30 days with keep-me-signed-in (`session-lifetime.ts`). Follow code.
- Doc: CLAUDE.md says TenantContextGuard skips path prefixes. Code: no path prefixes (guard comment). Follow code.
## Oddities
- Password minimum is 6 (login, register, change, reset) but 8 in user admin create.
- `UserController` uses `AuthGuard('jwt')` per handler in addition to the global JwtAuthGuard.
- `TenantContextMiddleware` and `ContextMiddleware` exist but are unregistered.
## Security
- Authentication: a revoked session's already-issued access token stays valid until expiry (session not checked per request).
- Rate limiting: in-process counters; client address derived from a forwarding header.
- Account protection: no failed-login logging for wrong passwords, no lockout, no second factor, short minimum password length.
- Session housekeeping: no purge of old session or security log rows.
