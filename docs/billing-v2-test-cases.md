# Billing v2 — Manual Test Cases

Manual, click-through testing of the billing feature in the running app (web-app `http://localhost:3000`, backend `http://localhost:5000`). No automation scripts (no Playwright / Cypress / Jest-E2E). Record each case as **PASS / FAIL / BLOCKED** with a one-line note; for FAIL add the steps, what happened, and the network error `code` if any.

## 0. Setup (do once)

| # | Step | Expected |
|---|---|---|
| 0.1 | Dev DB only: old billing rows block the schema sync. **Ask the owner before** running `TRUNCATE invoices, invoice_items, payments, coupons CASCADE;` | Owner confirms; backend starts without TypeORM sync errors |
| 0.2 | Start backend (`npm run start:dev`) and web-app (`npm run dev`) | Both start, no errors in console |
| 0.3 | Log in as **clinic admin** with the portal credentials the owner gave; select a location | Dashboard loads |
| 0.4 | Organization features: `billing.invoices` and `billing.discounts` ON | Sidebar shows Billing, Invoices, Payments, Billing activity, Doctor revenue |

Test data used below: **Consultation Rs 1,200**, **Scaling Rs 3,000** (day 1), **Filling Rs 1,800** (day 2), one test patient "Ali Khan" (plus one patient with an Urdu name).

## 1. Settings (admin) — Settings → Billing

| # | Steps | Expected |
|---|---|---|
| 1.1 | Open Payments and printing tab | Document code prefilled from location code (or empty), due days 7, A4 formats |
| 1.2 | Set document code `abc1` → Save | Saved as `ABC1` |
| 1.3 | Set document code `A` or `ABCDEFG` | Field error "2–6 letters or digits", Save disabled |
| 1.4 | Payment accounts tab | A `Cash` account exists, marked Default, "Counted" |
| 1.5 | Add account "Meezan Bank", kind Bank transfer | Reference "Required" on by default, cash count off |
| 1.6 | Add "JazzCash" (Online wallet), then deactivate it with the switch | Becomes inactive |
| 1.7 | Try deactivating Cash (the default) | Error toast: choose another default first |
| 1.8 | Services tab → add "Consultation" (kind Consultation, Rs 1,200), "Scaling" (Procedure, 3,000), "Filling" (Procedure, 1,800) | All listed with prices |
| 1.9 | Add a service with a duplicate name | Error toast "already exists" |
| 1.10 | Add price override: Scaling, all doctors, Rs 2,800; then Scaling for Dr X, Rs 2,500 | Both overrides listed |
| 1.11 | Payments and printing → Consultation fee service = Consultation → Save | Saved |
| 1.12 | Discount types tab → add "Staff 20%" (Percentage 20); add "Rs 500 off" (Fixed 500, reception editable 100–500, note required) | Both listed; range shows 100–500 |
| 1.13 | Discount type with Percentage 150 | Field error "At most 100%" |

## 2. Automatic charges from the queue

| # | Steps | Expected |
|---|---|---|
| 2.1 | Check in Ali Khan for Dr X; doctor starts consultation, adds treatment "Scaling", completes | Doctor screen shows no amounts anywhere |
| 2.2 | As admin/reception open Billing desk (today) | Ali Khan listed under Ready to bill with 2 charges |
| 2.3 | Patient page → Billing tab → Open charges | Consultation Rs 1,200 + Scaling (priced Rs 2,500 via Dr X override) |
| 2.4 | Remove the consultation fee service in settings, complete another patient's visit | Consultation charge shows **Needs price** badge |

## 3. Unbilled charge actions (patient Billing tab)

| # | Steps | Expected |
|---|---|---|
| 3.1 | Add charge → Catalog service "Filling" | Charge added at its resolved price |
| 3.2 | Add charge → Other, "X-ray film", Rs 350 | Added |
| 3.3 | Row ⋯ → Edit quantity 2 on Filling | Net doubles |
| 3.4 | As **receptionist**: try changing the price of a catalog charge | Price field disabled / server error "Only an admin can change a catalog price" |
| 3.5 | Set a price on a "Needs price" charge (as receptionist) | Allowed; badge disappears |
| 3.6 | Discount "Staff 20%" on Scaling | Discount shown, net reduced by 20% |
| 3.7 | Discount "Rs 500 off" as receptionist with value 600 | Error: value must be between 100 and 500 |
| 3.8 | Same type, value 300, no note | Error: note required |
| 3.9 | As receptionist, try custom discount | Option not shown (admin only) |
| 3.10 | Void the X-ray charge with reason "added by mistake" | Charge disappears from open charges |
| 3.11 | Void with reason "abc" (<5 chars) | Confirm disabled / validation error |

## 4. Collect payment (main flow) — scenarios S1–S6

Fresh patient with Consultation 1,200 + Scaling 3,000 (day 1) and Filling 1,800 (day 2), all unbilled.

| # | Steps | Expected |
|---|---|---|
| 4.1 | Collect payment → all charges ticked | Amount prefilled Rs 6,000; summary says invoice will be issued for 3 charges |
| 4.2 | Amount 5,800, Cash, Confirm | Success: receipt number `CODE-REC-2026-00001`, invoice `CODE-INV-2026-00001` issued |
| 4.3 | Open the invoice | Total 6,000, paid 5,800, balance 200, **Partially paid**; Filling has 200 balance |
| 4.4 | Collect again, only Filling selected, Rs 200 | No new invoice; invoice now **Paid** |
| 4.5 | New patient, same 3 charges, collect Rs 7,000 | Invoice Paid; summary shows advance Rs 1,000 |
| 4.6 | Patient with no open charges → collect Rs 5,000 | Receipt only, no invoice; advance 5,000 |
| 4.7 | Add new charge Rs 3,000 → open collect sheet, amount 0, "Use advance" on | Button "Apply advance Rs 3,000"; confirm issues invoice, Paid; advance 2,000 |
| 4.8 | Advance 1,000 exists, charge 3,000, collect 2,000 with Use advance | Charge fully paid (1,000 advance + 2,000 new) |
| 4.9 | Manual mode, type more than a charge's balance | Error "larger than the charge balance", Confirm disabled |
| 4.10 | Manual mode, amounts summing above amount received | Error "add up to more than the money" |
| 4.11 | Choose Meezan Bank without reference | Confirm disabled until reference entered |
| 4.12 | Double-click Confirm quickly | Only one receipt created |
| 4.13 | Charge with "Needs price" selected | Warning "Set a price for…", Confirm disabled |
| 4.14 | Success screen → Print receipt / Print invoice | Browser print dialog; PDF file name = document number |

## 5. Invoices

| # | Steps | Expected |
|---|---|---|
| 5.1 | Invoices page: status tabs, counts, stat cards | Counts match the invoices created |
| 5.2 | Search by invoice number, patient name, phone | Filters correctly; Clear all resets |
| 5.3 | Card / list toggle, pagination | Both views show the same data |
| 5.4 | Settings due days = 0, issue invoice, next day (or change clinic date) | Unpaid invoice shows **Overdue** |
| 5.5 | Patient leaving without paying: Open charges → select → Issue invoice | Invoice issued, Unpaid |
| 5.6 | Cancel that unpaid invoice with a reason | Cancelled banner; charges back to "Not invoiced" |
| 5.7 | Try cancel on a paid invoice | Cancel button hidden (server would return 409) |
| 5.8 | Edit a fully paid Rs 6,000 invoice: void Consultation, reason "patient not seen" | Preview: new total 4,800, Rs 1,200 to advance; save → Rev 2, refundable 1,200 |
| 5.9 | Revision history | Rev 2 with reason; "Print rev 1" prints the old lines/totals |
| 5.10 | Open the same invoice in two tabs, edit in both | Second save shows "changed by someone else" + Reload |
| 5.11 | Edit: add an unbilled charge to the invoice | Total increases, balance due |

## 6. Refunds

| # | Steps | Expected |
|---|---|---|
| 6.1 | Patient with advance → Refund advance Rs 500 cash, reason | Confirm dialog names amount + patient; voucher number `CODE-RFD-…`; advance reduced |
| 6.2 | Refund more than advance | Error "larger than the patient's advance" |
| 6.3 | Invoice from 5.8 → Refund Rs 1,200 | Invoice shows **Refunded Rs 1,200**, refunds table lists it |
| 6.4 | Edit invoice voiding all charges → Save & refund full amount | Invoice shows **Refunded** |
| 6.5 | Refund more than invoice's refundable | Error "larger than what can be refunded" |
| 6.6 | Print refund voucher | A4 voucher with signature lines |

## 7. Patient tab, statement, badges

| # | Steps | Expected |
|---|---|---|
| 7.1 | Summary cards | Not invoiced / Outstanding / Overdue / Advance match the data |
| 7.2 | Statement tab, no dates | Rows for invoice issued, payment, adjustment, refund; running balance; closing = outstanding − advance |
| 7.3 | Statement with a from-date | Opening balance shown; print statement works |
| 7.4 | Patient header | Red "Rs X due" badge when owing, green "Advance Rs X" when holding advance |
| 7.5 | Queue board (list view) | Billing column with badges; "Bill" button on completed entries opens collect sheet |
| 7.6 | Turn off "Show dues at check-in" | Badges disappear |

## 8. Payments page, cash close

| # | Steps | Expected |
|---|---|---|
| 8.1 | Payments page today | Per-account totals (Cash, Meezan), refunds subtracted, receipts list |
| 8.2 | Close counter: Cash expected 2,500, count 2,400, no note | Note required error |
| 8.3 | Same with note | Closed; history shows variance −100; Print slip works |
| 8.4 | New payment after close → Close counter again | Only the new payment in the window |

## 9. Reports and activity (admin)

| # | Steps | Expected |
|---|---|---|
| 9.1 | Doctor revenue, this month | Billed / discounts / collected per doctor, totals row |
| 9.2 | Billing activity, today | Feed of issues, edits (with reasons), discounts, refunds; per-user day totals |

## 10. Roles and security

| # | Steps | Expected |
|---|---|---|
| 10.1 | Log in as **doctor** | No billing sidebar items, no Billing tab, no badges, no Bill button, no amounts |
| 10.2 | Doctor opens `/invoices` directly | "You don't have access" page |
| 10.3 | As **receptionist** | Billing, Invoices, Payments visible; Billing activity, Doctor revenue, Settings → Billing hidden |
| 10.4 | Receptionist opens `/settings/billing` directly | Access denied page |
| 10.5 | Switch to another location | Billing data is per location; numbers use that location's code |

## 11. Printing and Urdu

| # | Steps | Expected |
|---|---|---|
| 11.1 | Invoice print A4 and Thermal 80 mm | Layouts correct, totals right-aligned |
| 11.2 | Receipt for a patient with an Urdu name, note in Urdu | Urdu text joined and right-to-left |
| 11.3 | Cancelled invoice print | "CANCELLED" watermark |

## Report format

Return a table: `# | Result | Note`, then a short list of FAILs with repro steps and the API error `code` (from the network response `error.code`).
