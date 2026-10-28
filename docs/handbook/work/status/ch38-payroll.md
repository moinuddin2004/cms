| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 38 | Generate payroll for a month | [Implemented] | Base + commission, settlement lock, future months refused |
| 38 | Month-end automatic generation | [Implemented] | Cron 0 5 1 * * server time; comment says 00:05 |
| 38 | Create a payroll record by hand | [Implemented] | No assignment or future-month check; commission 0 |
| 38 | View payroll for a month or employee | [Implemented] | month/year validation 400 |
| 38 | Mark a record as paid | [Implemented] | Also pays settlement; records payout only |
| 38 | Put a record on hold | [Partial] | Endpoint exists; no button, edit dialog status works |
| 38 | Edit a payroll record | [Implemented] | Amount is total; floor at commission |
| 38 | Delete a payroll record | [Implemented] | Releases pending settlement; refused if commission paid |
| 38 | Export a month as CSV | [Partial] | Endpoint only, no button |
| 38 | Payslip PDF | [Partial] | Endpoint only, no button |
| 38 | Deductions, tax and bank files | [Not implemented] | Deductions fixed at 0 |
