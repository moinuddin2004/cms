# Conflicts — ch09

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| backend/docs/modules/01-organizations-locations.md | (not mentioned) | Org form plan select sends `FREE/BASIC/PREMIUM/ENTERPRISE`; DTO enum is `free/starter/professional/enterprise`, so choosing a plan gives 400 (by reading) | `OrganizationManagementView.tsx:229-232`, `subscription-plan.enum.ts` |
| backend/docs/modules/01-organizations-locations.md | Example names ("Dr. Ahmed", "Smile Dental", branch "KHI") | Replaced with neutral examples | style rule |
| CLAUDE.md | TenantContextGuard path-prefix skip for /organizations, /locations | No prefix list | `tenant-context.guard.ts` |

Facts reused from generated chapter 01 were spot-checked against the code and are consistent.

## Oddities
- Several edit screens send whole rows under `forbidNonWhitelisted` (expected 400, not executed).
- `UpdateLocationSettingsDto` field names do not match the entity.
- Locations default to UTC/USD.
