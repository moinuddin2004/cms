# Conflicts — ch10

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| Catalog seed | `billing.discounts` named "Discounts & Coupons" | Coupons removed; discount types | `feature-catalog.seed.ts` |
| Catalog seed | `comms.in_app` "In-app notification center" | No code reads the key | grep |
| Catalog seed | `comms.whatsapp`, `hr.commissions` active | No code behind them | grep |
| Catalog seed | `inventory.alerts` "Low-stock and expiry alerts" | Job only logs (TODO) | `inventory/services/inventory-alerts.service.ts` |
| docs/access-control/test-cases.md FEAT-08 | Expects "refused" | Code returns 200 no-op (per INVENTORY) | INVENTORY section 2.2 |

## Oddities
- An organization with no flag row counts as entitled with catalog defaults (legacy compatibility); new organizations get non-default features un-entitled.
- `FeatureFlagGuard` trusts the location header without membership check (safe: it only narrows).
