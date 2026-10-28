# Conflicts and oddities — Chapter 35 (Commissions)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| docs/commissions.md | Target is min(allocations, net) | Pre-tax part pro-rated by net/(net+tax), then capped; lab-cost basis reduces the base | `commission-math.ts` commissionTarget |
| docs/commissions.md | recordForCharges is the only write path | LabCommissionService.recordForInvoices also inserts entries (lab_invoice_line_id) | `lab-finance/lab-commission.service.ts` |
| docs/commissions.md | Access by role (clinic admin, any actor who can consult) | Permissions compensation.manage, earnings.all.view, earnings.own.view | `commissions.controller.ts`, `compensation-plans.controller.ts` |
| docs/commissions.md | Unique (source_type, source_id, charge_id) | Also a partial unique on lab lines; charge_id nullable with check | `commission-entry.entity.ts` |

## Oddities

- Feature key `hr.commissions` exists in the catalog but nothing checks it.
- `CommissionSourceType.MANUAL` is never written; the UI labels it "Adjustment".
- The append-only trigger's frozen-column list does not include `lab_invoice_line_id` (written before lab lines existed).
- Invariant I10 and the earnings "Collected" column ignore lab invoice lines.
- `GET /commissions` has no screen. The Doctor earnings page has no location switch although the API supports one.
- The Compensation tab shows for compensation.manage but renders content only when the employee has an assignment id.

## Security

- Access-control category: the commission-share figure is gated on the server by permission; no issue found. Money-integrity: the ledger relies on a database trigger; no further detail.
