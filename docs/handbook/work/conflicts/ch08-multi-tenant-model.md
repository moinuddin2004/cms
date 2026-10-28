# Conflicts — ch08

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| CLAUDE.md | "JWT tokens carry organization context" | JWT carries sub, email, globalRole, sessionId only | `auth/jwt.service.ts` |
| CLAUDE.md | TenantContextGuard skips `/organizations`, `/locations` by prefix | Uses decorators only | `tenant-context.guard.ts` |

## Oddities
- The employee person record is Platform-wide (unique phone), but `EmployeesService.create` refuses an existing phone and is the only place assignments are created; no API adds a second location or clinic to an existing employee.
- `AuthorizationService.validateAccess` for owners checks the location is active but not the organization's `is_active`.

## Security
- Tenant isolation is application-level only, no database row-level security (isolation category; INVENTORY section 7 lists one endpoint missing an organization filter).
