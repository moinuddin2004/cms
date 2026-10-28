| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 8 | Organization/location tenancy with organization_id filters | [Implemented] | No DB row-level security |
| 8 | Ownership (multiple owners) | [Implemented] | organization_ownership |
| 8 | Shared employee person record with several assignments | [Partial] | API creates only one assignment; no endpoint adds another |
| 8 | Tenant headers + TenantContextGuard | [Implemented] | No path-prefix skips |
| 8 | Login with org/location selection | [Implemented] | Super admin always picks org |
| 8 | Location switching | [Implemented] | Invalidates all queries |
| 8 | ClockService location timezone | [Implemented] | Unknown tz falls back to UTC |
| 8 | Deactivated org stops owner requests | [Partial] | validateAccess does not check org is_active for owners |
