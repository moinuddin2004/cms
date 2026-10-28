# Conflicts — ch07

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| README.md | PostgreSQL "local or Neon" | API always connects with SSL options; a non-SSL local server may refuse (not verified) | `app.module.ts`, `ensure-extensions.ts`, `outbox-relay.service.ts` |
| README.md | Redis optional in dev | True for realtime; access/settings buses and Bull still try to connect | `redis-connection.ts`, `app.module.ts` |
| README.md First login | "/register creates your account" | Self-signup also creates a trial clinic, MAIN location and ownership | `subscriptions/clinic-setup.service.ts` |

## Oddities
- No Node `engines` field in either package.json.
- `npm run test:int` matches every `*.int-spec.ts` under `backend/test/` with the billing global setup.
