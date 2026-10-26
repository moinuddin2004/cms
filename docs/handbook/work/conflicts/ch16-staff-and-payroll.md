# Conflicts and oddities — ch16-staff-and-payroll.md

## Code comment vs schema
- **`EmployeesService.remove` comment** says appointments, invoices etc. keep their rows with the doctor set to NULL. **Schema:** `appointments.doctor_id`, `queue_sessions.doctor_id`, `charges.doctor_id`, `service_prices.doctor_id`, `lab_orders.doctor_id` are RESTRICT (NOT NULL for appointments/sessions). The delete is refused, and the caught 23503 error tells the user the employee "has linked inventory records" even when the blocker is an appointment. Evidence: `employees/employees.service.ts` remove(); ENTITY_CATALOG §6 rows 73, 80, 128, 158, 231.

## Oddities
- `doctor_availability_overrides` is edited via the employee availability tab, but `appointments` does not import or read it; availability uses only `employee_schedules`.
- `employee_org_location_assignments.gross_salary` deprecated but still present.
- `payroll_records` stores the total twice (paisa and numeric rupees).
- `employees.phone` / `cnic` unique Platform-wide (no org column).
