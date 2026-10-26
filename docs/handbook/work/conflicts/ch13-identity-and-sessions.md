# Conflicts and oddities — ch13-identity-and-sessions.md

## Oddities
- `oauth_providers` is registered in AuthModule `forFeature` but no service injects or queries it; OAuth strategies are not registered (`auth.module.ts` comment: Google/GitHub sign-in is disabled). Dead table.
- `users.refresh_token` is marked deprecated in favour of `user_sessions.refresh_token_hash`; still present.
- `users.global_role` entity comment refers to `organization_admins` / `user_locations`, tables that exist only in the never-executed baseline.

## Security
- Category: personal data retention. `security_logs` and `user_sessions` store network address and browser strings with no retention or cleanup job found in the code reviewed for this chapter.
