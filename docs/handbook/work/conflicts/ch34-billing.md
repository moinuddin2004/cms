# Conflicts and oddities — Chapter 34 (Billing)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| `docs/billing-v2-test-cases.md` 0.1 | Truncate `invoice_items`, `coupons` | Tables do not exist | `backend/src/billing/entities` |
| `docs/billing-v2-test-cases.md` 3.4 | Error "Only an admin can change a catalog price" | "You are not allowed to change a catalog price — give a discount instead"; permission `billing.price.override`, not a role | `charges/price-policy.ts` |
| `docs/billing-v2-test-cases.md` 6.2 / 6.5 | "larger than the patient's advance" / "larger than what can be refunded" | "The patient's advance is only Rs …" / "Only Rs … can be refunded from this invoice" | `refunds/refunds.service.ts` |
| `docs/billing-v2-test-cases.md` | Amounts assume no tax | Exclusive location tax is added at issue | `tax/invoice-tax.ts` |
| `docs/billing-v2-test-cases.md` 8.1 | Real bank brand as account name | Test data only; chapter uses "Example Bank" | — |
| `docs/billing-feature-context.md` | Pre-v2 model | Outdated throughout; not used | INVENTORY.md |
| Feature seed | `billing.discounts` named "Discounts & Coupons", "Create coupons" | No coupons exist | `feature-catalog.seed.ts` |
| Task brief | 81 endpoints | 84 route handlers in `backend/src/billing`, 6 of them commissions | controller decorators |

## Oddities

- `billing.invoices` has `enabledByDefault: false`.
- Payments sidebar item checks `billing.payment.collect`; the route checks `billing.invoice.view`.
- No UI for unapply, so an invoice with any payment cannot be cancelled from the web app.
- Billing desk Outstanding omits PARTIALLY_PAID invoices.
- `show_outstanding_at_check_in` is not enforced by `GET /billing/outstanding`.
- Patient credit expiry uses server `new Date()` / `setHours` (project rule says use the location clock); credits are not linked to payments or charges.
- Expenses: hard delete with no confirmation, update/delete looked up by organization only, no billing audit.
- Unused web API wrappers: payment detail, unapply, refund list, cash-close detail, resolved price, update price override, plan billing summary, credit packages, daily summary, update expense.
- Invoice revision history is rebuilt from `billing_audit_logs` snapshots, not a revisions table.
- Accountant template has no discount permissions; Receptionist cannot edit, cancel, refund or close the counter.

## Security

- Tenant scoping within an organization: expense update and delete are checked against the organization but not the active location (category only).
