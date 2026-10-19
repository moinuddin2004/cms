# Doctor compensation and commissions

Doctors (any staff whose employment role can consult) can be paid a fixed
salary, a commission on what patients pay for their work, or both. Commission
is calculated automatically from billing and paid out through payroll.

Feature flag: `billing.commissions` (per organization). With it off, salaries
still work: the old "Update salary" action writes salary-only plan versions.

## Model

| Table | What it holds |
|---|---|
| `compensation_plans` | How one **assignment** (employee × location) is paid, valid for `[effective_from, effective_to]` (inclusive, `NULL` = current). Type `SALARY`, `COMMISSION` or `SALARY_PLUS_COMMISSION`; `base_salary_paisa`, `default_rate_bps`, `commission_basis` (`NET`/`GROSS`). A GiST exclusion constraint forbids overlapping versions. |
| `commission_rules` | Overrides of one plan for one catalog service or one service category (`ServiceKind`): a rate (bps) **or** a fixed amount (paisa) per fully paid charge. |
| `charges` (4 columns) | Snapshot taken when a visit charge is created: `performing_assignment_id`, `commission_plan_id`, `commission_rate_bps` / `commission_fixed_paisa`. Null on old, manual and salary-only charges. |
| `commission_entries` | Append-only ledger, signed paisa, one row per change. `UNIQUE (source_type, source_id, charge_id)`. A trigger refuses deletes and any update except `settlement_id`. |
| `commission_settlements` | A batch of entries paid through one payroll record (`PENDING` → `PAID`). |
| `payroll_records` (3 columns) | `base_salary_paisa`, `commission_paisa`, `total_paisa`; `salary_amount` (rupees) mirrors the total for older screens. Unique per employee × **location** × month. |

Money is integer paisa, rates integer basis points (4000 = 40.00%). No
floating point is used: products are BigInt, numeric columns are converted
to paisa in SQL (`(amount * 100)::bigint`), UI input is parsed as text
(`percentToBps`, `rupeesToPaisa`).

`employee_org_location_assignments.gross_salary` is **deprecated**: the
migration copied it into a `SALARY` plan per assignment and nothing writes it
any more (the employee API still returns `grossSalary`, now read from the
current plan).

## Versioning

`POST /assignments/:id/compensation-plans` closes the open version on
`effective_from − 1 day` and inserts the new one, in one transaction with the
assignment row locked. A version that starts the same day as the latest one
replaces it, unless a charge already used it (`409 COMPENSATION_PLAN_IN_USE`).
Starting before the latest version → `409 COMPENSATION_PLAN_OVERLAP`. Wrong
field combinations → `422 COMPENSATION_PLAN_INVALID`; commission on a role
that cannot consult → `422 COMMISSION_ROLE_CANNOT_CONSULT`.

Rate changes never alter past commission: each charge keeps its snapshot.
`PUT /compensation-plans/:id/rules` only affects charges created afterwards.

## Snapshot

`ChargeSourcesService.syncForEncounter` (queue completion, same transaction)
looks up the doctor's assignment at the location and the plan in force on the
visit's clinic date (`ClockService`), and resolves the rate with
`resolveCommissionRate`: service rule → category rule → plan default. A
`SALARY` plan keeps the rate null. Changing the doctor of an unbilled visit
charge re-takes the snapshot for the new doctor.

## Recording (earned on collection)

`CommissionService.recordForCharges(tx, chargeIds, source)` is the only write
path. For each charge with a snapshot:

```
collected = min(SUM(allocations on charge), net)      net = 0 when VOID
net = 0                 → target = 0
rate, NET basis         → target = round(collected × rate / 10000)
rate, GROSS basis       → target = round(collected × gross × rate / (net × 10000))
fixed amount            → target = round(fixed × collected / net)
already = SUM(entries.amount_paisa for the charge)
target ≠ already        → insert entry (amount = target − already)
```

`round` is half up (away from zero), in BigInt. Because the target is
cumulative there is no rounding drift across installments, unapply and voids
reverse themselves, discounts and price changes adjust automatically, and a
replayed request writes nothing.

Called inside the same transaction, under the caller's charge locks (no new
locks; order stays invoices → charges → payments), from:

| Path | Source type | Source id |
|---|---|---|
| `PaymentsService.runCollect` — collect payment **and** apply advance (old advance is allocated FIFO here) | `ALLOCATION` | new payment id, else an operation id |
| `PaymentsService.unapply` | `UNAPPLY` | operation id |
| `InvoicesService.runEdit` — quantity, price, discount, void, add charges; also "refund from invoice", which runs the edit first | `CHARGE_ADJUST` (`VOID` for a voided charge) | operation id |

No other path can change allocations or the net of a billed charge: every
`ChargesService` mutation is restricted to unbilled charges (no allocations,
so the target stays 0), and invoice cancel requires no payments. `needsPricing`
charges produce nothing until they are priced and paid.

Commission is never added to charge or invoice totals and never appears on
patient invoices, receipts or prints; audit snapshots (used by invoice
revisions and the activity log) strip the snapshot columns.

## Settlement and payroll

`PayrollService.generate` (and the month-end job) reads the plan in force on
the last day of the month (else the first):

- base salary from the plan (`SALARY` / hybrid), 0 for `COMMISSION`;
- commission = every unsettled entry of the assignment created before the end
  of the period, locked `SELECT … FOR UPDATE`, linked to a new `PENDING`
  settlement of that payroll record. If the unsettled balance is negative
  (only reversals), it is **not** settled; it carries forward and offsets the
  next period's earnings;
- total = base + commission. Nothing to pay → listed under "no salary".

Settled entries are never changed: an unapply after settlement writes a
negative entry that lands in the next settlement. Marking payroll paid marks
its settlement `PAID`. Deleting an unpaid payroll record releases its entries
back to the unsettled pool; once paid it cannot be deleted. Payslip PDF and
CSV export show base salary, commission and total.

## API (`billing.commissions`)

| Route | Role |
|---|---|
| `GET/POST /assignments/:id/compensation-plans` | clinic admin |
| `PUT /compensation-plans/:id/rules` | clinic admin |
| `GET /commissions?assignmentId&from&to&locationId` | clinic admin (another location only if admin there too) |
| `GET /reports/doctor-earnings?from&to&locationId` | clinic admin: collected, earned, settled, pending per doctor |
| `GET /me/earnings?from&to&locationId` | any actor who can consult; only assignments of the signed-in user |
| `POST /payments/preview` → `doctorShare` | admins only (null for reception); computed by the backend with the same target function, never on the frontend |

Report columns: *collected* = allocations (net of releases) on the doctor's
charges in the range; *earned* = entries written in the range; *settled* /
*pending* = the part of *earned* already in a settlement / not yet.

## Invariant

`BillingInvariantChecker` I10: for every charge with a snapshot,
`SUM(commission_entries) = target`, computed independently in SQL numeric.
`BillingInvariantJob` runs all invariants nightly (02:30, where scheduled jobs
run) and logs violations.

## Edge cases

- Charge without a doctor, manual charges, salary-only doctors → no entries.
- Doctor at two locations: two assignments, two plans, two payroll records.
- Plan changed mid-month: old charges keep the old rate; payroll uses the plan
  in force at month end for the salary part.
- Feature switched off: no new snapshots; existing snapshots keep recording so
  the ledger stays consistent.
- Overpayment beyond net goes to advance, never into `collected`.
