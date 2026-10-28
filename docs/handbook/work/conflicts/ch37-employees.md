# Conflicts and oddities — Chapter 37 (Employees)

## Doc-vs-code conflicts

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| OUTLINE / INVENTORY | Availability overrides and leave are fully implemented | Recorded and edited, but never read by booking, queue or payroll | grep of appointments, queue, payroll |
| OUTLINE | Attendance listed | Not implemented; only in hr.leave description | feature-catalog.seed.ts |
| OUTLINE | Assignments to organization and location | Only created together with a new person; CreateAssignmentDto unused | employees.service.ts |

## Oddities

- Duplicate CNIC (and duplicate phone on edit) reaches DB unique index and returns a generic 500.
- Employee code = assignment count + 1; can repeat after deletions.
- Create is not one transaction: person saved before login and assignment.
- `employees.is_active` never written; assignment flag is used.
- `ScheduleService.checkCrossLocationConflict` is never called.
- Create/edit portal path skips the subscription user-limit check that User Admin applies.
- `PATCH /employees/:id/portal-access`, `PATCH schedule/:dayOfWeek`, `GET salary-history` client have no screen use.
- Leave endpoints are all behind leave.approve: no self-service. Rejection stores the reviewer in approved_by.
- Availability override delete has no confirm dialog; icon buttons lack tooltips. `/employees/create` page exists but nothing links to it.
- Leave balance counts all organization leave and server calendar year.

## Security

- Identity category: staff-login password minimum differs between the two paths (6 vs 8 characters). Plain-text password fields in the create DTO. No exploit detail.
- Authorization category: leave and override lists scope by location on some routes and by organization on others.
