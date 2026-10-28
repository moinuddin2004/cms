# Hand-back — Chapter 37 (Employees)

- File: `src/part5-modules/ch37-employees.md`; 15 features: 10 Implemented, 3 Partial (overrides, leave, leave summary), 2 Not implemented (second-location assignment, attendance).
- Figures: 9 total — 6 placeholders (list, add dialog, detail, schedule tab, leave tab, staff login), 3 diagrams (ERD 37.7, leave state 37.8, employee status 37.9).
- All diagrams rendered OK; ERD and leave PNGs opened.
- Unverified: `employees` role defaults (Admin only holds employees.view, deduced from templates); runtime error text for duplicate CNIC (deduced as generic 500 from global filter).
- Unverified: whether the access subscriber bumps on cascade deletes beyond what the service comments say.
- Conflicts in `work/conflicts/ch37-employees.md`.
