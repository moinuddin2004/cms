# Conflicts — ch05

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| CLAUDE.md | 4 global guards | 5 (SubscriptionGuard last) | `app.module.ts` |
| CLAUDE.md | JwtAuthGuard skips `@Public()` | Only checks `PUBLIC_ROUTES` | `auth/guards/jwt.guard.ts` |
| CLAUDE.md | TenantContextGuard skips path prefixes | No prefixes; decorators only | `tenant-context.guard.ts` |
| README.md architecture diagram | Guard chain JWT, Tenant, FeatureFlag, Access | Subscription guard missing | `app.module.ts` |

## Oddities
- The request-context middleware in `bootstrap/http.ts` runs `contextService.run(req.user, ...)` before guards set `req.user`, so `RequestContextService.getUser()` (used in `user/user.service.ts:163`) likely returns undefined. Not executed.
- `ContextMiddleware` and `TenantContextMiddleware` are never registered.
- `POST /patients` returns HTTP 201 but the envelope says `httpStatusCode: 200`.
- Patient number is count+1 computed outside the transaction (race possible under concurrent creates).

## Security
- The error envelope's `devMessage` carries raw internal exception messages for unexpected (500) errors (information-exposure category).
