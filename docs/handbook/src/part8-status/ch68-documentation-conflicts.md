# Chapter 68 — Documentation Conflicts

This chapter records where existing documents, code comments and screen texts disagree with the code. In every case the handbook follows the code. It is for the owner and for new developers, who need to know which documents can be trusted and which should not be used. The table merges the document inventory made before the handbook was written with the conflicts that each chapter found.

## 68.1 Conflicts table

| Document | Claim | Code reality | Evidence |
|---|---|---|---|
| Root project instructions | The frontend uses `app`, `shared` and feature `api` folders | The code uses `routes`, `components`, `lib`, `store` and feature `services` | Chapter 4 |
| Root project instructions | There are four global guards | There are five; the subscription guard comes last | Chapters 5, 11 |
| Root project instructions | The tenant guard skips path prefixes, and the JWT guard skips public markers | There are no prefixes; the guard uses decorators only, and the JWT guard checks a list of public routes | Chapters 5, 8 |
| Root project instructions | Tokens carry organization context | Tokens carry user id, email, global role and session id only | Chapter 8 |
| Root project instructions | Inventory, invoices, reports and notifications are stubs | They are implemented; only chairs is entity-only | Chapters 4, 12, 20, 23 |
| Root project instructions | Soft deletes by an active flag in most modules | Patient delete is a hard delete | Chapter 28 |
| Root project instructions | Some dashboard widgets use mock data | The live dashboard uses real data; the mock widgets are not imported | Chapter 36 |
| Root project instructions | Organizations own employee role definitions | The role entity lives in employees, with logic in access | Chapter 15 |
| Root readme | Bull queue and Google and GitHub sign-in are part of the stack | The queue has no producer or consumer, and OAuth is not registered | Chapter 4 |
| Root readme | The architecture diagram shows four guards | Five guards | Chapter 5 |
| Root readme | `/register` creates your account | It also creates a trial clinic, main location and ownership | Chapter 7 |
| Root readme and backend readme | The start script runs `dist/main` | The build emits the entry file one folder deeper | Chapter 6 |
| Environment example | Refresh, email and reset secrets are required | No code reads them; several variables the code reads are missing | Chapter 6 |
| Access-control guide | `GET /me/catalog` | The endpoint is `GET /access/catalog` | Chapter 11 |
| Access-control guide | Assistant template summary | The Assistant also holds the lab orders view permission at location scope | Chapter 11 |
| Access-control test cases | FEAT-08 expects "refused" | The code returns a successful no-op | Chapter 10 |
| Appointments and queue guide | No migration files; production must still switch from synchronize | There are three migrations, and production already runs with synchronize off plus a reviewed schema sync | Chapters 6, 12, 29, 30 |
| Appointments and queue guide | The worker runs one or more instances | Exactly one worker may run | Chapters 6, 30 |
| Appointments and queue guide | Realtime fan-out uses the Socket.IO Redis adapter | It uses its own Redis publish and subscribe with a worker heartbeat | Chapter 30 |
| Appointments and queue guide | Validate runs the same rules as create; overlap gives a coded conflict | Validate skips the past-time check and the override flag; the read-time overlap has no code, only the database path does | Chapter 29 |
| Appointments and queue guide | API list is complete | It omits the session creation endpoint | Chapter 30 |
| Commissions guide | Target is the smaller of allocations and net | The pre-tax part is pro-rated and capped, and a lab-cost basis reduces the base | Chapter 35 |
| Commissions guide | One method writes commission entries | A lab commission service also writes entries for lab lines | Chapter 35 |
| Commissions guide | Access by role | Access by the permissions `compensation.manage`, `earnings.all.view`, `earnings.own.view` | Chapter 35 |
| Billing test cases | Truncate a coupons table; amounts assume no tax; role-based error texts | Coupons do not exist; exclusive tax applies; permission-based messages | Chapter 34 |
| Old billing context pack | Describes pre-version-two billing | Outdated throughout | Chapter 34 |
| Feature catalog seed | `billing.discounts` "Discounts & Coupons"; `reports.exports` as CSV and PDF | Coupons were removed; exports are Excel and PDF | Chapters 10, 36 |
| Feature catalog seed | `comms.in_app`, `comms.whatsapp`, `hr.commissions` are active features | Nothing checks them | Chapter 10 |
| Feature catalog seed | `inventory.alerts` gives low-stock and expiry alerts | The job only writes a log line | Chapters 10, 39 |
| Entity catalog | Notes for ten inventory tables | Shifted one row down | Chapter 23 |
| Entity catalog | A trigger protects published form versions | No such trigger; the service enforces it | Chapter 26 |
| Entity catalog | `charges.source_id` is discriminated by `source_type` | The column is named `source` | Chapter 20 |
| Entity catalog | Only the queue writes the idempotency table | Workflow, lab billing, lab orders and vendor payments also write it, and the queue clean-up deletes all rows older than a day | Chapter 18 |
| Entity catalog | `patient_visits` is a per-location summary | Nothing writes it | Chapter 27 |
| Entity catalog | Append-only list is complete | The allocation and journal-line tables are also called append-only without triggers | Chapter 27 |
| Entity catalog | Migration creates the audit tables completely | It lacks the subject column and index present in the entity | Chapter 26 |
| Migration for compensation | `charge_id` is not null | The entity allows null and adds a lab-line column and a check | Chapter 22 |
| Code comment on patient delete | Related rows cascade | Billing and lab rows block the delete with RESTRICT keys | Chapter 17 |
| Code comment on employee delete | Related rows keep the row with the doctor set to null | They are RESTRICT, and the message names inventory even when an appointment blocks it | Chapter 16 |
| Code comment on prescription numbers | Sequential per organization | Unique across the Platform | Chapter 19 |
| Code comment on plan templates and screen text | Procedures are copied into a patient's plan | Nothing creates a patient plan from a template | Chapter 33 |
| Code comment in billing audit entity | The repo has no general audit module | A general audit table exists | Chapter 21 |
| Code comment on journal source | Expenses post journals | Only lab finance posts journals | Chapter 21 |
| Code comment in payroll | Runs at 00:05 on the first | The schedule is 05:00 server time | Chapter 38 |
| Code comments in lab modules | The portal will manage the lab catalog; the clinic activates labs until the portal ships | The portal ships and lets a lab admin act on links, but only a super admin manages the catalog | Chapter 40 |
| Queue settings screen text | Changes apply from tomorrow | Only the smart-queue switch is fixed per day | Chapter 30 |
| Access guard comment | A missing marker becomes a boot error | Only a unit test enforces markers | Chapter 11 |
| First inventory document | Recall, feedback and referral are implemented through a CRM tab | The tab is never mounted; recalls have no component | Chapter 28 |
| First inventory document | Leave and availability overrides are implemented | They can be recorded but are never read by booking or payroll | Chapter 37 |
| First inventory document | Inventory is implemented | The module works through the API but has no sidebar entry and some writes are unverified | Chapter 39 |
| First inventory document | Digital consent signing is unverified | It is implemented with a signature pad | Chapter 28 |
| Outline | The booking form is a sheet; lab order comes before automatic charges | It is a dialog; lab work never creates clinic charges | Chapters 29, 48 |
| Patients visit tab text | A visit is recorded at check-in | The encounter is created at start of consultation | Chapter 28 |

The table shows that most drift is in descriptions of structure (folders, guards, stubs) and in comments written before a redesign. The numbers and behaviours in the code are more stable than the words around them.

## 68.2 Documents and how far they can be trusted

The following documents are current or mostly current and may be used, with the corrections in the table: the generated entity catalog and the organizations and locations chapter, the access-control guide, the database migrations guide, the root readme (for the process split and counts) and the appointments and queue guide.

The following are outdated and should not be used for decisions: the hand-off note (it mentions an appointment token that no longer exists and fixed problems), the project overview (it predates access control, billing version two and the lab modules), the audit file (seven of its ten most serious findings are fixed), the plan file (its checklist is stale) and the old billing context pack (it describes replaced code). The two stock starter readmes carry no project information. The design mock-up file in the repository root uses a former name and does not describe the current screens. The root project instructions are partly outdated and need an update before they are given to a new developer or an assistant.

## 68.3 The CRM tab correction

The first document inventory marked recall, feedback and referral as implemented through a CRM tab on the patient page. The code shows that backend endpoints exist but the tab component is never mounted in the patient detail page, so those features cannot be reached by a user, and recalls have no component at all. The handbook therefore labels them Partial. Any plan or sales material that repeated the earlier claim should be corrected.

## 68.4 Using this chapter

Treat the handbook as the source of truth and the code as the final authority. When a document in the table is edited, update the row, so it does not return as a source of confusion. Chapter 65 lists the same drift among the known gaps, and Chapter 67 asks which documents the owner wants archived.
