# Glossary — ch13-identity-and-sessions.md

- **users** — User account: one login account for the whole Platform.
- **oauth_providers** — Linked external sign-in identity (Google, GitHub); table exists but is unused.
- **security_logs** — Security event log: logins, logouts, password and session events.
- **user_sessions** — Login session: one signed-in device with its own hashed refresh token.
- **Global role** — `users.global_role`; its only value is `super_admin`.
- **Session revocation** — Setting `user_sessions.is_revoked` to true so the session is no longer valid.
