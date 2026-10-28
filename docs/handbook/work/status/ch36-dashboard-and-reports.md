| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 36 | See the home dashboard | [Partial] | Real data; money tiles also need billing.financial_summary; mock dashboard.api.ts and ~10 widgets unused |
| 36 | Read the finance overview | [Implemented] | /reports/finance/overview, gated finance.overview.view, 12-month trend, warnings |
| 36 | Read the profit and loss statement | [Implemented] | Collected vs billed basis; costs by own period; payroll base salary only |
| 36 | Read the clinic overview | [Partial] | Default Doctor role (own scope) sees sidebar item but API refuses |
| 36 | Browse the report library | [Implemented] | 37 reports, filtered by permission and own-scope doctor filter |
| 36 | Run a report on screen | [Implemented] | 5,000 row cap, scope resolution, rupees |
| 36 | Download a report as Excel or PDF | [Implemented] | 50,000 rows, PDF max 5,000, audit EXPORT row |
| 36 | The 37 reports | [Implemented] | 15 financial, 22 clinical; 9 categories |
| 36 | Daily financial summary | [Partial] | Backend only; /financial-summary redirects to /dashboard |
