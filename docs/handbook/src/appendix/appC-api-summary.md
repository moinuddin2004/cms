# Appendix C — API Endpoint Summary

This appendix maps the Platform's backend API, one line per controller file. A controller is a group of related endpoints that share a URL prefix. The backend has **80 controller classes in 74 files, with 593 endpoints** in total. Where one file holds two small controllers, they share a line. Four of those endpoints belong to the Google and GitHub sign-in controller, which exists in the code but is not registered, so those routes do not exist at runtime. The full method-by-method detail of each endpoint is described in the module chapter named in the last column.

## C.1 How every endpoint is protected

Every request passes five global guards in this order:

1. **JWT.** Checks the sign-in token, except on routes listed as public.
2. **Tenant context.** Checks that the user belongs to the organization and location named in the request headers.
3. **Feature flag.** Checks features required by `@RequireFeature`.
4. **Access.** Checks `@Can` permissions.
5. **Subscription.** Blocks writes when a clinic's subscription has expired (read-only mode).

Each endpoint also declares how access is decided:

- **`@Can(…)`:** needs specific permissions. This is the normal case.
- **`@AnyMember`:** any member of the organization may call it.
- **`@Public`:** no sign-in, such as the TV display or a lab magic link.
- **`@ContextFree`:** the handler checks access itself, because it runs before a location is chosen or outside a clinic.
- **`@RequireSuperAdmin`:** platform staff only.
- **Lab portal:** routes under `/lab-portal/…` use a separate lab-member guard instead of clinic permissions.

A test fails the build if any endpoint has none of these.

**Technical references:** `backend/src/app.module.ts` (guard order) · `backend/src/access/access-coverage.spec.ts` · `backend/src/labs/portal/lab-actor.ts` · `LabPortalController`

## C.2 Controllers

| Module | Base path | Endpoints | Access | What it is for | Chapter |
|---|---|---|---|---|---|
| app | `/` | 1 | none | Root greeting / health response | 6 |
| auth | `/auth` | 17 | Public + ContextFree | Register, verify email, login, location selection and switching, token refresh, logout, sessions, passwords | 56 |
| auth (OAuth) | `/auth/google`, `/auth/github` | 4 | Public | Google / GitHub sign-in; **not registered, routes do not exist** [Not implemented] | 56 |
| user | `/user` | 6 | ContextFree | User administration, staff login candidates | 56 |
| access | `/me` (`/me/access`) and `/access/catalog` | 2 | ContextFree / Can | The signed-in user's resolved access; the permission catalog for the roles screen | 11, 57 |
| access (navigation) | `/admin/navigation` | 3 | Can | The clinic's sidebar layout: read, save, reset | 58 |
| organizations | `/organizations` | 7 | SuperAdmin (settings read ContextFree) | Create and manage organizations and their settings | 9 |
| locations | `/locations` | 7 | ContextFree (checks `admin.locations.manage` itself) | Create and manage locations and location settings | 9 |
| feature-flags (platform) | `/feature-flags` | 10 | SuperAdmin (own list ContextFree) | Feature catalog; entitle and enable features per organization; seed | 10 |
| feature-flags (clinic) | `/admin/features` | 4 | Can | Owner switches features on and off, previews impact, sets location overrides | 10, 58 |
| settings-registry (theme) | `/public/theme`, `/theme`, `/admin/theme`, `/platform/theme` | 8 | Public / AnyMember / Can / SuperAdmin | Clinic theme and branding at platform, organization and location level | 58 |
| subscriptions (clinic) | `/account` | 5 | AnyMember | Clinic account and the setup wizard | 45 |
| subscriptions (platform) | `/admin/subscriptions` | 6 | SuperAdmin | Subscription status, manual payments, payment instructions | 45 |
| employees | `/employees` | 8 | Can | Employee records, status, staff login access, salary | 37 |
| employees (schedule) | `/employees/:employeeId/schedule` | 3 | Can | Weekly working hours per location | 37 |
| employees (availability) | `/employees/:employeeId/availability-overrides` | 4 | Can | One-off changes to a doctor's availability | 37 |
| employees (leave) | `/leaves` | 8 | Can | Leave requests, approval, balance | 37 |
| employees (roles list) | `/employment-roles` | 5 | Can | Roles used when assigning employees | 11 |
| employees (roles admin) | `/admin/roles` | 6 | Can | Owner's role builder: create, clone, edit, delete roles | 11, 58 |
| payroll | `/payroll` | 10 | Can | Generate monthly payroll, mark paid / on hold, export, payslip PDF | 38 |
| patients | `/patients` | 43 | Can | Patient records, import and export, and all clinical and CRM sub-records | 28 |
| appointments | `/appointments` | 13 | Can | Booking, availability, validation, confirm, cancel, no-show, check-in | 29 |
| queue (reception) | `/queue` | 18 | Can / AnyMember | Queue sessions, walk-ins, check-in, skip, rejoin, transfer, priority, policies, tickets | 30 |
| queue (doctor) | `/queue` | 15 | Can | The doctor's own queue: call next, select, recall, start consultation, send for test, complete | 30 |
| queue (display) | `/queue/displays` | 1 | Public | Data for the waiting-room TV display | 30 |
| encounters | `/encounters` | 5 | Can | The consultation record and workspace; treatments added during a visit | 31 |
| treatments | `/treatments` | 3 | Can | Treatments performed and the treatment catalog | 31 |
| plan-templates | `/plan-templates` | 4 | Can / AnyMember | Reusable treatment plan templates | 33 |
| prescriptions | `/prescriptions` | 15 | Can | Prescriptions: build, medicines, finalize, duplicate, PDF, history | 32 |
| prescriptions (medicines) | `/medicine-directory` | 6 | Can / AnyMember | The clinic's medicine directory | 32 |
| prescriptions (templates) | `/prescription-templates` | 6 | Can / AnyMember | Prescription print templates and the default template | 32 |
| prescriptions (protocols) | `/treatment-plan-templates` | 5 | Can / AnyMember | Reusable medicine protocols for prescriptions | 32 |
| prescriptions (signatures) | `/doctor-signatures` | 4 | Can / AnyMember | Doctors' signature images for printed prescriptions | 32 |
| billing (config) | `/billing` | 16 | Can | Service catalog, location prices, billing settings, payment accounts, discount types | 34 |
| billing (charges) | `/patients/:id/charges`, `/charges`, `/billing/ready-to-bill` | 9 | Can | Charges: list, add, from a treatment plan, edit, discount, void; the ready-to-bill list | 34 |
| billing (payments) | `/payments`, `/refunds`, `/patients/:id/advance` | 10 | Can | Collect payment (with preview), unapply, apply advance, refunds, daily collection | 34 |
| billing (invoices) | `/invoices` | 9 | Can | Invoices: list, stats, revisions, edit with preview, cancel, refund | 34 |
| billing (patient billing and closing) | `/patients/:id/billing`, `/billing/…`, `/treatment-plans/:id/billing-summary` | 11 | Can | Patient summary and statement, outstanding, cash close, doctor revenue, billing activity | 34 |
| billing (print) | `/print` | 5 | Can | Print data for invoices, receipts, refunds, statements, cash close | 34 |
| billing (expenses) | `/expenses` | 5 | Can | Clinic expenses and the expense summary | 34 |
| billing (credit packages) | `/credit-packages` | 7 | Can | Prepaid credit packages and patient credits (no screen) | 34 |
| billing (financial summary) | `/financial-summary` | 3 | Can | Daily, monthly and trend figures for the dashboard | 36 |
| billing (commissions) | `/commissions`, `/reports/doctor-earnings`, `/me/earnings` | 3 | Can | Commission ledger, doctor earnings, a doctor's own earnings | 35 |
| billing (compensation) | `/assignments/:id/compensation-plans`, `/compensation-plans` | 3 | Can | Doctors' compensation plans and commission rules | 35 |
| reports | `/reports` | 5 | Can / AnyMember | Report catalog, finance overview, clinic overview, run a report, export to Excel or PDF | 36 |
| inventory | `/inventory` | 15 | Can | Categories, items, stock levels, stock adjustments and movements | 39 |
| inventory (suppliers) | `/suppliers` | 5 | Can | Suppliers | 39 |
| inventory (purchase orders) | `/purchase-orders` | 6 | Can | Purchase orders: status, receive | 39 |
| inventory (consumption templates) | `/consumption-templates` | 6 | Can | Standard material lists per treatment type | 39 |
| inventory (patient consumption) | `/patient-consumptions` | 4 | Can | Materials used for a patient or appointment | 39 |
| notifications (inbox) | `/me/notifications` | 4 | ContextFree | The signed-in user's in-app notifications | 44 |
| notifications (settings) | `/notification-settings` | 9 | Can | Audiences, rules, templates, delivery log, patient preferences | 44 |
| uploads | `/uploads` | 1 | AnyMember | File upload to storage | 28 |
| labs (platform) | `/platform/labs` | 10 | SuperAdmin | The platform lab directory: labs, status, members, links | 40 |
| labs (clinic links) | `/lab-links` | 7 | Can / AnyMember | The clinic's connections to labs | 40 |
| lab catalog (platform) | `/platform/service-categories` | 15 | SuperAdmin | Lab service categories, services, options and prices | 40 |
| lab catalog (clinic) | `/lab-catalog` | 13 | Can / AnyMember | The clinic's lab price list, price quotes, service mappings, order templates | 40 |
| lab orders (clinic) | `/lab-orders` | 14 | Can | Lab orders: create, from template, submit, revise, repeat, messages, attachments, work order | 40 |
| lab access (clinic) | `/lab-orders/:id/magic-links`, `/lab-orders/:id/proxy` | 8 | Can | Send and revoke magic links; act for a lab that has no login | 40 |
| lab production (clinic) | `/lab-orders/…`, shipments | 15 | Can | Clinic side of production: try-ins, stage decisions, approve / reject / deliver items, remakes, receive shipments | 40 |
| lab access (magic link) | `/lab-link/:token` | 5 | Public | What a lab can do through a magic link without a login | 41 |
| lab access (order link) | `/order-links` | 1 | ContextFree | Resolve a short order link to the right place | 41 |
| lab portal | `/lab-portal` | 8 | Lab portal | The lab's own profile, team (members) and clinic connections | 41 |
| lab portal (orders) | `/lab-portal/orders` | 12 | Lab portal | Lab side of orders: accept, reject, clarification, expected date, messages, revisions, charge requests, attachments | 41 |
| lab portal (production) | `/lab-portal/production` | 15 | Lab portal | Production board: start, assign, finish, QC; shipments; remake disputes | 41 |
| lab portal (payables) | `/lab-portal/payables` | 5 | Lab portal | The lab's view of the clinic's bills, payments and statements | 41 |
| lab billing | `/lab-billing` | 18 | Can | Patient lab invoices: draft, issue, void, advance, credit notes, reminders, payments, refunds, settings | 42 |
| lab payables | `/lab-payables` | 19 | Can | Vendor bills, vendor payments and allocations, lab statements, aging / monthly-cost / case-profit reports | 42 |
| engine (workflows) | `/platform/workflow-templates` | 15 | SuperAdmin | Versioned workflow templates, states, transitions; stage templates; specialties | 43 |
| engine (forms) | `/platform/form-schemas` | 15 | SuperAdmin (reads AnyMember) | Versioned form schemas with validation, publish and retire | 43 |

The table maps each API area to its module chapter. Most controllers use `@Can`, so a specific permission decides who may call them. A few kinds use other access rules:

- **Platform administration** (organizations, features, the lab directory, the lab catalog, Config Studio) is for the super admin only.
- **The lab portal controllers** serve lab staff and use their own guard.
- **Three kinds are public:** the TV display, magic links, and the public theme a clinic's login page needs before anyone signs in.

The endpoint counts add up to 593 including the four unregistered sign-in routes, so 589 routes are live. The access column is a summary: inside one controller, individual endpoints can need different permissions, and the module chapters list them per feature.
