| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 35 | Set up or change a compensation plan | [Implemented] | Versioned per assignment, GiST no-overlap, compensation.manage |
| 35 | See the current plan and version history | [Implemented] | Compensation tab in employee detail |
| 35 | Edit service-wise overrides (commission rules) | [Implemented] | Replace rules of current version; service > category > default |
| 35 | Snapshot the rate on each visit charge | [Implemented] | CONSULTATION and TREATMENT charges only; backend by design |
| 35 | Earn commission when patient money is applied | [Implemented] | Cumulative target, NET/GROSS, tax pro-rating, fixed amount; backend by design |
| 35 | Earn commission on lab work | [Implemented] | Lab-line commissions, net of lab cost; backend by design |
| 35 | Preview the doctor share while collecting payment | [Implemented] | doctorShare gated by earnings.all.view and billing.commissions |
| 35 | See every doctor's earnings | [Implemented] | /billing/doctor-earnings; GET /commissions has no screen |
| 35 | See my own earnings | [Implemented] | /my-earnings, filtered by signed-in user |
| 35 | See doctor revenue | [Implemented] | /billing/doctor-revenue, reports.financial.view, not commission |
| 35 | Settle commission through payroll | [Implemented] | lockUnsettled, create, markPaid, release |
| 35 | Protect the ledger (append-only trigger, I10) | [Implemented] | Trigger in migration; nightly I10 covers charges only |
| 35 | Choose a commission plan when adding an employee | [Implemented] | compensation object on POST /employees |
| 35 | Manual commission adjustments | [Not implemented] | MANUAL source type reserved, never written |
