| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 37 | Browse and filter the employee list | [Implemented] | Assignments at active location, server paging |
| 37 | Add an employee | [Implemented] | Platform-unique phone checked; CNIC only by DB index |
| 37 | View an employee | [Implemented] | Scoped to active location |
| 37 | Edit an employee | [Implemented] | Duplicate phone/CNIC on edit gives generic 500 |
| 37 | Activate or deactivate an employee | [Implemented] | Assignment is_active; employees.is_active never written |
| 37 | Delete an employee permanently | [Implemented] | Refused if other locations or referenced rows |
| 37 | Give an employee a staff login | [Implemented] | Employee form and User Admin; PATCH portal-access has no screen |
| 37 | Set or update the salary | [Implemented] | Adds compensation plan version from today |
| 37 | Set the weekly schedule | [Implemented] | 7 days, slot 15/30/45/60; cross-location check never called |
| 37 | Record availability overrides | [Partial] | CRUD works; booking ignores them |
| 37 | Manage leave requests | [Partial] | Manager-only; approved leave ignored by booking and payroll |
| 37 | See the leave summary | [Partial] | Usage tally, no entitlements |
| 37 | List employment roles | [Implemented] | GET /employment-roles, employees.view |
| 37 | Assign an existing employee to another location | [Not implemented] | DTOs exist, no endpoint |
| 37 | Attendance | [Not implemented] | Only in hr.leave description |
