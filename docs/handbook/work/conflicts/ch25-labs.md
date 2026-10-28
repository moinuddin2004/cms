# Conflicts — ch25-labs

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| `magic-link.entity.ts` comment | `shipment_id` has "no FK until that table exists here" | `shipments` exists; FK still missing; `receive_shipment` purpose never created by any code | grep `RECEIVE_SHIPMENT` → entity only |
| `lab-statement.entity.ts` | `attachment_id` stores the statement file | Comment says no storage for statement files yet | ENTITY_CATALOG §5 `lab_statements` |
| ENTITY_CATALOG notes | Quote "lab ERD §…", "Sprint 5 deviation" | Internal design references not followable by readers; omitted from chapter | INVENTORY.md defect 3 |

## Oddities
- `lab_order_items.clinic_treatment_id` has no FK while `service_mappings.clinic_treatment_id` has one to the same table.
- Every lab FK is ON DELETE RESTRICT (deliberate: void/reverse instead of delete).
