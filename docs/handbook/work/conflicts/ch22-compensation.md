# Conflicts — ch22-compensation

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| Migration `1792403456699-doctor-compensation` | `commission_entries.charge_id` NOT NULL; no lab line column | Entity: `charge_id` nullable, `lab_invoice_line_id` added with CHECK `chk_commission_entries_target`; prod `schema:sync:prod` must add these | ENTITY_CATALOG §2.1 |
| `docs/commissions.md` (per WRITING_GUIDE) | Omits lab-line commissions | Entries can target `lab_invoice_lines` | `commission-entry.entity.ts` |

## Oddities
- `compensation_plans` → assignment is ON DELETE CASCADE, but `charges.commission_plan_id` → plan is RESTRICT, so deleting an assignment whose plan was used is blocked.
- `CommissionSettlements.release` deletes the settlement row when payroll is deleted before payment (`billing/commissions/commission-settlements.ts`).
