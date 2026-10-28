# Conflicts — ch20-billing-core

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| CLAUDE.md | `invoices` is an entity-only stub | Billing v2 invoices are fully implemented | `backend/src/billing/entities/invoice.entity.ts`, invoices services and routes `/invoices` |
| ENTITY_CATALOG.md §5 (`charges`) | `source_id` is "discriminated by `source_type`" | The discriminator column on `charges` is `source` (there is no `source_type` column) | `charge.entity.ts` |

## Oddities
- `refunds.payment_account_id` has no FK, while `payments.payment_account_id` does.
- No tenant column in billing v2 has an FK to `organizations` / `locations`; no comment explains why.
- `payment_allocations` is described as append-only but has no trigger.
