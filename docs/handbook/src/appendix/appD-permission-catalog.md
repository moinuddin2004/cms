# Appendix D — Permission Catalog

This appendix lists every permission the Platform knows. There are 70 in total, and the code defines them in one file. A permission is the smallest unit of access a role can be given, for example "void an invoice". An owner never invents new permissions. Instead, the owner combines these 70 into roles, using None / Basic / Full bundles per module or the Advanced mode for single permissions.

Five rules decide how a permission behaves:

- **Feature.** Each permission belongs to one feature. When that feature is not active for the organization, or is switched off at a location, the permission is dropped while access is worked out. It is not deleted from the role, so switching the feature back on restores access exactly as it was.
- **Scope.** Some permissions carry a scope: `own` (only records linked to the user, such as a doctor's own patients or queue), `location` (the active location) or `org` (every location of the organization). A wider scope includes the narrower ones.
- **Also grants.** Some permissions automatically include others. For example, editing patients includes viewing them.
- **Risk.** Permissions marked "high" ask for a confirmation and a reason when an owner grants them in the roles screen.
- **Who holds what.** Owners and the super admin hold every permission. Staff hold only what their role at the active location grants. A missing permission means no access: the system is fail-closed.

The tables below are grouped by the module the roles screen lists them under. Each row gives the permission key exactly as the code spells it, the label the roles screen shows, the feature it depends on, the scopes it accepts ("—" means it has no scope), the permissions it also grants, and whether it is high-risk.

**Technical references:** `backend/src/access/catalog/permissions.ts` · `PERMISSIONS` · `backend/src/access/catalog/bundles.ts` · `backend/src/access/catalog/templates.ts` · generated copy `web-app/src/features/access/generated/catalog.ts`

### Patients

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `patients.view` | View patients | `patients.core` | own, location, org | — | — |
| `patients.create` | Register patients | `patients.core` | — | `patients.view` | — |
| `patients.edit` | Edit patient details | `patients.core` | — | `patients.view` | — |
| `patients.delete` | Delete patients | `patients.core` | — | `patients.view` | high |
| `patients.export` | Export patient data | `patients.core` | — | `patients.view` | high |
| `patients.price.view` | See treatment prices | `patients.core` | — | — | — |
| `patients.clinical.view` | View clinical records | `patients.core` | — | — | — |
| `patients.clinical.edit` | Edit clinical records | `patients.core` | — | `patients.clinical.view` | — |
| `patients.documents.manage` | Manage patient documents | `patients.documents` | — | — | — |
| `patients.chart.edit` | Edit dental chart | `patients.teeth_chart` | — | `patients.clinical.view` | — |
| `plans.manage` | Manage treatment plans | `patients.treatment_plans` | — | — | — |
| `plans.templates.manage` | Manage treatment plan templates | `patients.treatment_plans` | — | — | — |

### Appointments

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `appointments.view` | View appointments | `appointments.core` | own, location, org | — | — |
| `appointments.book` | Book appointments | `appointments.core` | — | `appointments.view` | — |
| `appointments.reschedule` | Reschedule appointments | `appointments.core` | — | `appointments.view` | — |
| `appointments.cancel` | Cancel appointments | `appointments.core` | — | `appointments.view` | — |
| `appointments.override_rules` | Override booking rules | `appointments.core` | — | `appointments.book` | high |

### Queue

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `queue.board.view` | View reception queue board | `appointments.core` | — | — | — |
| `queue.checkin` | Check patients in | `appointments.core` | — | `queue.board.view` | — |
| `queue.entry.manage` | Skip, rejoin or remove queue entries | `appointments.core` | — | `queue.board.view` | — |
| `queue.entry.reprioritize` | Reprioritize the queue | `appointments.core` | — | `queue.board.view` | — |
| `queue.doctor.own` | Run own doctor queue | `appointments.core` | — | — | — |
| `queue.doctor.any` |  | `appointments.core` | — | `queue.doctor.own` | — |
| `queue.display.manage` | Manage TV display | `appointments.core` | — | — | — |

### Consultation

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `consultation.conduct` | Conduct consultations | `patients.core` | own, location, org | `patients.clinical.edit` | — |
| `prescriptions.create` | Write prescriptions | `patients.prescriptions` | — | — | — |
| `prescriptions.library.manage` | Manage prescription library | `patients.prescriptions` | — | — | — |

### Billing

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `billing.desk.use` | Use the billing desk | `billing.invoices` | — | — | — |
| `billing.invoice.view` | View invoices | `billing.invoices` | own, location, org | — | — |
| `billing.invoice.edit` | Edit invoices | `billing.invoices` | — | `billing.invoice.view` | — |
| `billing.invoice.void` | Void invoices | `billing.invoices` | — | `billing.invoice.view` | high |
| `billing.payment.collect` | Collect payments | `billing.invoices` | — | `billing.invoice.view` | — |
| `billing.refund.issue` | Issue refunds | `billing.invoices` | — | `billing.invoice.view` | high |
| `billing.price.override` | Override prices | `billing.invoices` | — | — | high |
| `billing.cash_close` | Close the cash drawer | `billing.invoices` | — | — | — |
| `billing.activity.view` | View billing activity | `billing.invoices` | — | — | — |

### Discounts

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `billing.discount.apply` | Apply preset discounts | `billing.discounts` | — | — | — |
| `billing.discount.custom` | Give custom discounts | `billing.discounts` | — | `billing.discount.apply` | high |

### Expenses

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `expenses.view` | View expenses | `billing.expenses` | — | — | — |
| `expenses.manage` | Record and edit expenses | `billing.expenses` | — | `expenses.view` | — |

### Commissions

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `earnings.own.view` | See own earnings | `billing.commissions` | — | — | — |
| `earnings.all.view` |  | `billing.commissions` | — | `earnings.own.view` | — |
| `compensation.manage` | Manage salaries and commissions | `billing.commissions` | — | `earnings.all.view` | high |

### Lab

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `lab.orders.view` | View lab orders | `dental.lab_orders` | own, location, org | — | — |
| `lab.orders.create` | Create lab orders | `dental.lab_orders` | — | `lab.orders.view` | — |
| `lab.billing.manage` | Manage lab billing | `dental.lab_orders` | — | — | — |
| `lab.catalog.manage` | Manage lab catalog | `dental.lab_orders` | — | — | — |
| `lab.payables.manage` | Manage lab payables | `dental.lab_orders` | — | — | — |
| `lab.links.manage` | Manage lab links | `dental.lab_orders` | — | — | — |
| `lab.templates.share` | Share lab order templates | `dental.lab_orders` | — | — | — |

### Inventory

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `inventory.view` | View inventory | `inventory.core` | — | — | — |
| `inventory.stock.adjust` | Adjust stock | `inventory.core` | — | `inventory.view` | — |
| `inventory.po.manage` | Manage purchase orders | `inventory.core` | — | `inventory.view` | — |

### Team

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `employees.view` | View staff | `` | — | — | — |
| `employees.manage` | Manage staff | `` | — | `employees.view` | — |
| `payroll.manage` | Manage payroll | `hr.payroll` | — | — | high |
| `leave.approve` | Approve leave | `hr.leave` | — | — | — |

### Reports

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `reports.clinical.view` | View clinical reports | `reports.clinical` | own, location, org | — | — |
| `reports.financial.view` | View financial reports | `reports.financial` | own, location, org | — | — |
| `reports.export` | Export reports | `reports.exports` | — | — | high |
| `finance.overview.view` | View finance overview | `reports.financial` | — | — | — |

### Admin

| Permission | Label | Feature | Scopes | Also grants | Risk |
|---|---|---|---|---|---|
| `admin.features.manage` | Turn clinic features on/off | `` | — | — | high |
| `admin.roles.manage` | Manage roles and permissions | `` | — | — | high |
| `admin.users.manage` | Manage users and their access | `` | — | — | high |
| `admin.nav.manage` | Customize the sidebar | `` | — | — | — |
| `admin.settings.manage` | Manage clinic settings | `` | — | — | — |
| `admin.locations.manage` | Manage locations | `` | — | — | — |
| `admin.audit.view` | View the audit log | `` | — | — | — |
| `admin.theme.manage` | Manage clinic theme and branding | `` | — | — | — |
| `notifications.settings.manage` | Manage notification settings | `` | — | — | — |

## How to read these tables

These tables show the full set of building blocks for roles. A permission whose feature is `core` is always available, because no feature switch controls it. A permission with scopes listed must be granted with exactly one of those scopes. The roles screen offers the scope as a choice in Advanced mode, and the bundles pick a sensible default. For which permissions each of the five system roles (Admin, Doctor, Receptionist, Assistant, Accountant) receives, see Chapter 11, "Roles and permissions", which explains the templates in prose.
