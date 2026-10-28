# Conflicts and oddities — Chapter 38 (Payroll)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| Code comment on runMonthEndPayroll | Runs at 00:05 on the 1st | Cron `0 5 1 * *` = 05:00 server time | payroll.service.ts |
| OUTLINE | CSV export and payslip PDF as features | Endpoints exist; no web-app caller | grep web-app/src |
| OUTLINE | Mark on hold | Endpoint exists; client function unused; edit dialog status works | payroll.api.ts |

## Oddities

- Month-end month comes from server `new Date()`, not location timezone; job ignores organization active state and hr.payroll flag.
- Setting status to paid through PATCH /payroll/:id does not set paid date, method or settlement status; a later delete would release commission.
- createManual does not verify the assignment or reject future months.
- Export designation column and payslip designation line are empty (employee has no designation field).
- Delete confirmation uses window.confirm instead of ConfirmDialog.
- Deductions always 0.00; net = gross.
- Generate payroll modal on an employee tab generates for the whole location.

## Security

- Financial-data category: payroll endpoints rely on one high-risk permission; no field-level restriction. No exploit detail.
