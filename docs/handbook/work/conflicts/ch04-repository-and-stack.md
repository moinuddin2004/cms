# Conflicts — ch04

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| CLAUDE.md | Frontend uses `src/app/`, `src/shared/`, feature `api/` folders | `src/routes/`, `src/components/`, `src/lib/`, `src/store/`, feature `services/` | `web-app/src/` listing |
| CLAUDE.md | inventory, invoices, reports, notifications are stubs | All implemented; only `chairs` is entity-only | backend controllers |
| README.md | Bull listed as used | Queue `submissions` registered, no producer or consumer | `app.module.ts`; no `@Processor`/`InjectQueue` |
| README.md | Google/GitHub OAuth in stack | OAuth not registered | `auth/oauth.controller.ts` |

## Oddities
- `@nestjs/mongoose`/`mongoose`, `@nestjs/cache-manager`/`cache-manager`, `@nestjs/swagger` are dependencies no source file imports.
- Some features (organizations, locations) call axios directly from components, contrary to CLAUDE.md.
