# Conflicts — ch23-inventory

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| ENTITY_CATALOG.md §5 inventory | "Notes" comments per column | Shifted one row down: each comment belongs to the column above (e.g. "NEVER update directly" is on `currentStock`, not `unit`) | `backend/src/inventory/entities/inventory-item.entity.ts`, `stock-movement.entity.ts`, `patient-consumption.entity.ts` |
| ENTITY_CATALOG.md (`patient_consumptions.templateId`) | Note "Not a FK relation to avoid circular" | That comment belongs to `treatmentPlanId`; `templateId` has an FK (SET NULL) | `patient-consumption.entity.ts` lines 55–65 |
| `purchase-order.entity.ts` comment | PO number "per organization" | Column is `unique: true` on its own (platform-wide), while `generatePoNumber` counts per organization → second organization's first PO collides | `inventory/services/purchase-order.service.ts:64-77` |
| CLAUDE.md | `inventory` is a stub | Module implemented; only legacy `inventory` table unregistered | `inventory.module.ts` forFeature |

## Oddities
- `stock_movements.organizationId` / `locationId` / `referenceId` are `varchar`, not uuid.
- `ConsumptionRecorder` (web) is exported but never rendered; patient consumption has no UI entry point.
- PO numbering reads the last order without locking (concurrent duplicates possible).
