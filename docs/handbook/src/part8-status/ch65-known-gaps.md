# Chapter 65 — Known Gaps

This chapter collects every gap found while the handbook was written: features that do not exist, features that exist in the backend but cannot be reached from the web app, settings that do nothing, data-integrity oddities and places where older documents describe something the code no longer does. It is for the owner who has to decide what to fix, build or promise before more clinics go live. Each gap states what it is, why it matters to an owner, which chapter holds the evidence, a severity and a suggested next step.

## 65.1 How severity is judged

Severity is judged by the effect on a live clinic, not by the effort to fix it.

- **High**: the problem can stop daily work (registering a patient, writing a prescription) or put the business at risk, and it can happen in normal use.
- **Medium**: a clinic would notice and need a workaround, or an expectation set by the product screens is not met, but daily work continues.
- **Low**: a convenience, a cleanup or a feature most clinics can live without.

No application was run while the handbook was written, so every gap was found by reading the code. Where a gap depends on behaviour that was deduced but not observed, the text says so.

## 65.2 Features that are not built

These features are absent. Some have a seeded feature key or a database table that suggests they exist; none of them works.

| Gap | Why it matters to an owner | Evidence | Severity | Suggested next step |
|---|---|---|---|---|
| No messages to patients by SMS, WhatsApp or email, and no appointment reminders | Clinics cannot remind patients of visits, so no-shows are handled by phone calls only. The notification pipeline already exists, but the only active channel is the in-app inbox for staff and lab members. | Chapters 44, 59 | Medium | Decide on a provider (Question 3 in Chapter 67), then switch on the patient audience and add a reminder event and job. |
| No renewal or trial-ending messages to clinic owners | An owner learns of an expiring trial only from the banner inside the app. Expiry puts the clinic in read-only mode. | Chapters 45, 53 | Medium | Send an email to the owner at fixed days before expiry. |
| No patient portal | Patients cannot see their own records or invoices online. The feature key was retired. | Chapters 1, 28 | Low | Treat as a roadmap item; no work needed for current clinics. |
| No online booking and no recurring appointments | Every booking is made by staff, and a course of visits must be booked one by one. | Chapter 29 | Low | Roadmap items. |
| No insurance claims and no online payment gateway | Insurance details can be stored (backend only) but no claim is created. Payments are recorded by staff, never collected online. | Chapters 28, 34 | Low | Roadmap items; confirm whether target clinics need them. |
| No server-generated PDF receipts or invoices | Receipts and invoices are printed from the browser (A4 and 80 mm). They cannot be emailed or stored as files. | Chapters 34, 48 | Low | Add a PDF generator only if sending receipts to patients becomes a requirement. |
| No attendance tracking | Payroll uses salary and commission only; there is no record of who came to work. Leave exists but is not read by payroll. | Chapter 37 | Medium | Decide whether attendance is wanted at all; if so, design it with payroll deductions. |
| No payroll deductions, tax or bank files | Net pay always equals gross pay, so deductions and withholding must be done outside the Platform. | Chapters 38, 51 | Medium | Define the deduction rules the target market needs, then add them to payroll generation. |
| No deploy or continuous-integration configuration | The repository holds no Dockerfile, pipeline or hosting configuration. How the Platform is deployed lives in people's heads. | Chapter 6 | High | Write down and automate the build, migration and process-role steps before more clinics depend on it. |
| Chairs exist as a table only | The `chairs` entity has no module, no endpoint and no screen. | Chapters 12, 26 | Low | Remove the entity or build the module; the rest of the Platform does not need it. |
| No lab order can be started from the consultation workspace | Doctors must leave the consultation and use the Lab orders page. Lab orders carry no link to the encounter. | Chapters 31, 48 | Low | Add a button that opens a lab order with the patient and doctor prefilled. |
| No structured allergy list and no drug-interaction check | Allergy alerts are text chips built from free-text fields. A doctor can prescribe a drug the patient is allergic to without any warning. | Chapter 31 | Medium | Add a structured allergy list first; a drug check can follow. |
| No way to assign an existing employee to a second location | The only way to create an assignment is to create a new employee, and a phone number that already exists is refused. A doctor who works at two locations cannot be set up. | Chapters 37, 47 | Medium | Add an endpoint and screen that create an assignment for an existing employee. |
| No SOAP note entity or note templates | Visit notes are four fixed text fields. Clinics that need structured notes cannot have them. | Chapter 31 | Low | Defer until a clinic asks. |
| No manual commission adjustment | The source type exists in the ledger but nothing writes it, so a one-off correction to a doctor's commission needs a database change. | Chapter 35 | Low | Add an adjustment screen with a reason and an audit row. |
| No per-location patient visit statistics | The `patient_visits` table is never written, so the endpoint always returns an empty list. | Chapters 17, 27, 28 | Low | Drop the table and endpoint, or fill it from encounters. |
| No organization-wide audit viewer and no audit for appointments, employees, payroll, organizations or locations | The owner cannot answer "who changed this?" for bookings, staff records or payroll. Only patient records have a history screen. | Chapter 60 | Medium | Extend the audit calls to the missing modules and add one viewer screen. |

The most important rows are the missing deploy configuration, which is an operational risk, and the missing second-location assignment, which blocks a normal multi-branch clinic. Everything else is either a feature a clinic would ask for later or a gap that staff can work around manually.

## 65.3 Built but unreachable from the web app

In these cases the backend is finished, or nearly so, but no screen calls it, so the feature cannot be used by a clinic. Each one is usually a small piece of web work.

| Gap | Why it matters to an owner | Evidence | Severity | Suggested next step |
|---|---|---|---|---|
| The inventory page has no sidebar entry and nothing links to it | Stock, suppliers and purchase orders work, but a user can only reach them by typing the address. Most staff will never find them. | Chapters 39, 55 | Medium | Add a sidebar entry; resolve the foreign-key question in Section 65.6 first. |
| Unapply a payment has no screen | An invoice that has any payment on it cannot be cancelled from the web app, because cancelling needs the payments released first. The workaround is a refund. | Chapters 34, 52 | Medium | Add an Unapply action to the payment detail. |
| Patient treatment plans have no screen | Creating, updating and tracking plans, turning plan items into charges and the plan billing summary exist only in the backend. Doctors cannot plan a course of treatment in the Platform. | Chapters 28, 33 | Medium | Build the plan screens, or remove the backend if plans are not wanted. |
| Payroll: put on hold, CSV export and payslip PDF have no buttons | An owner cannot give staff a payslip or export a month for an accountant from the Platform. | Chapters 38, 51 | Medium | Add the three buttons; the endpoints exist. |
| Lab portal: charge requests and file upload have no portal control | A lab cannot ask for an extra charge or attach a file from the portal, so these happen by message or phone. | Chapters 40, 41 | Medium | Add the two forms to the portal order page. |
| Lab portal: no notification inbox | Lab members receive in-app notifications that link into the portal, but the portal layout has no bell to show them. | Chapters 40, 41 | Medium | Add the bell to the portal header. |
| Cancel one lab item has no screen | Stopping one item of an order in progress is not possible from the web app. | Chapter 40 | Low | Add a Cancel item action on the order detail. |
| Recalls, referrals, feedback, insurance and the communications log | The component that shows them is never mounted, and recalls have no component at all. The data model is ready. | Chapter 28 | Low | Mount the tab or drop the claim; update the older documents that call it implemented. |
| Blacklist a patient | The flag can only be set through the API, and it blocks nothing when set. | Chapter 28 | Low | Decide what blacklisting should do (see Section 65.4), then add the control. |
| Override booking rules | The API flag and permission exist, but no booking screen sends it, so no one can book outside working hours or past the daily limit. | Chapter 29 | Low | Add an override option for users who hold the permission. |
| Cancel reasons | The API stores a reason code and note; the screen sends neither and shows no confirmation. | Chapter 29 | Low | Add the reason dialog. |
| Phone pre-check at registration | The endpoint and hook exist but no component calls them. The server rejects duplicates at save with a conflict message. | Chapter 28 | Low | Call the hook on the phone field. |
| Credit packages and patient credits | Backend only, and credits are not a payment method. | Chapter 34 | Low | Decide whether prepaid packages are wanted. |
| Plan billing summary, daily financial summary and several billing helpers | Endpoints and client functions exist but no component renders them. `/financial-summary` redirects to the dashboard. | Chapters 33, 34, 36 | Low | Remove unused code or build the screens. |
| About ten dashboard widgets that still use mock data | They are not on the live dashboard but remain in the code and could be mistaken for real features. | Chapter 36 | Low | Delete the mock module. |
| Queue: next-patient preview, queue history, the doctor's own session read and session creation | Backend only. The queue works without them. | Chapter 30 | Low | Add a history screen for supervisors if audit of the queue is needed. |
| Prescriptions: edit one medicine line, duplicate, change history viewer, lookup by appointment | Backend only. The history read and the duplicate action are also likely to fail (see Section 65.6). | Chapter 32 | Low | Fix the two defects, then add the screens. |
| Employee portal-access switch and some schedule calls | The endpoint exists, but the switch is set through the employee form instead. `/employees/create` exists but nothing links to it. | Chapter 37 | Low | Clean up. |
| Lab: vendor bill header edit, manual bill lines, using lab advance on bills, impressions to the lab, service categories, specialty enablement | Endpoints exist; no buttons call them. | Chapters 40, 42, 43 | Low | Build when the workflow is needed. |

The Medium rows share one theme: a flow is half-finished at the boundary between backend and web. Finishing the inventory entry, the unapply action and the payroll buttons would remove most of the daily friction an owner would see.

## 65.4 Seeded but inert

These things look real in the catalog, a table or a setting, but nothing reads them or acts on them.

| Gap | Why it matters to an owner | Evidence | Severity | Suggested next step |
|---|---|---|---|---|
| Legacy organization settings (booking defaults, advance booking days, cancellation notice, late fee percentage and old feature switches) | An owner can save these values and nothing changes. Only a location settings screen reads the old feature switches to hide sections. | Chapters 9, 14 | Medium | Remove the screen or wire the rules (Chapter 67, Question 5). |
| Blacklisted and inactive patient flags | A blacklisted or inactive patient can still be booked, queued and billed. Staff may assume the flag protects them. | Chapter 28 | Medium | Decide the intended rule and enforce it at booking and check-in. |
| Availability overrides and approved leave | They can be recorded and edited, but booking, validation, the calendar, the queue and payroll never read them. A doctor on approved leave can still be booked. | Chapters 29, 37 | Medium | Make booking and the calendar read them. |
| Feature keys that gate nothing (`comms.in_app`, `comms.whatsapp`, `hr.commissions`) | Switching these on or off has no effect. Twelve more keys for unbuilt features are deactivated at every start and are hidden. | Chapters 10, 35, 44 | Low | Retire the three keys or attach checks. |
| Notification events that are never emitted (`order.overdue`, `shipment.dispatched`, `tryin.appointment_due`, `appointment.rescheduled_lab_delay`) | Clinics can edit the wording of messages that will never be sent. There is no overdue job. | Chapters 40, 44 | Low | Add emitters or remove the events. |
| Quiet hours, patient opt-outs and the delivered status | Quiet hours are saved but never hold in-app messages. The outbox status `delivered` is never set. The opt-out screen is commented out. | Chapters 44, 59 | Low | Fix or remove. |
| The `queue.display.manage` permission | It is in the catalog and in the Receptionist template but nothing checks it. | Chapter 30 | Low | Attach it to display management or drop it. |
| Email verification | The verification state is stored but nothing is gated by it. | Chapters 45, 56 | Low | Decide whether unverified owners should be limited. |
| Dead schema and code (the table for linked external sign-ins, the deprecated refresh-token column, unused queue and database packages, per-role sidebar layouts that are never written, unused audit and history values, unused magic-link limits) | They add noise for the next developer and imply features that are not there. | Chapters 4, 13, 15, 32, 40, 58, 60 | Low | Clean up in one pass. |
| Settings registry beyond theme | The generic cascading settings store holds only theme keys. | Chapter 58 | Low | Move new settings onto it or leave as is. |

The Medium rows are the ones that mislead: a screen or flag that implies protection or behaviour the Platform does not provide. Cleaning them up costs little and removes false assurance.

## 65.5 Data-integrity oddities

These are places where the data model can produce a wrong or failing result in normal use. Several were deduced from code and constraints and not reproduced.

| Gap | Why it matters to an owner | Evidence | Severity | Suggested next step |
|---|---|---|---|---|
| Patient numbers are "count plus one", but patients can be permanently deleted | After any patient is deleted, the next registration computes a number that already exists and fails on the unique index. Because the count does not change, every later registration fails the same way. This was confirmed by reading the code. | Chapters 28, 62 | High | Use the safe sequence mechanism that billing uses, and stop hard-deleting patients that have history. |
| Prescription numbers are unique across the whole Platform, but are numbered per organization | The first prescription of a second clinic in the same year is numbered like the first clinic's first one and violates the unique key. This was confirmed by reading the code, but not run. | Chapters 19, 32, 62 | High | Make the number unique per organization, or use a Platform-wide sequence. |
| Purchase order numbers have the same flaw | Same cause, in inventory. A second clinic's first purchase order collides. | Chapters 23, 39, 62 | Medium | Same fix. |
| Other count-plus-one numbers (treatment plan, legacy prescription, employee code) and unlocked "last plus one" numbering | They can repeat after a delete or when two people save at the same moment. | Chapters 28, 33, 37, 62 | Medium | Move to the sequence mechanism. |
| Login id stored where an employee id is expected | Several writes (inventory movements and purchase orders, prescription duplication, saved doctor signatures) put a login id into columns defined as links to employees. In some tables there is no foreign key, so the value is silently wrong; where there is one, the write may fail. Not run. | Chapters 28, 32, 39, 55 | Medium | Decide which id each column should hold and make the code consistent. |
| Deleting a patient or an employee is blocked by `ON DELETE RESTRICT` rows and fails with a generic server error | The user sees "Something went wrong" instead of a reason. A code comment claims the rows cascade, but they do not. | Chapters 16, 17, 28, 37 | Medium | Catch the foreign-key error and give a clear message, or soft-delete. |
| Duplicate CNIC or phone number on employee edit | Reaches the database unique index and returns a generic error. | Chapter 37 | Low | Check before saving. |
| Employee phone and CNIC are unique across the whole Platform | By design one person record can serve several clinics, but the only creation path refuses an existing phone (see Section 65.2). A second clinic cannot hire someone another clinic already registered. | Chapters 8, 37 | Medium | Add the assign-existing-employee flow. |
| Tenant columns without foreign keys on most billing, queue and lab tables, and logical references to unknown targets (`dentist_id`, `manager_id`) | The database does not stop a row pointing at a missing or wrong organization. Nothing in the code explains the choice. | Chapters 12, 27 | Low | Document the decision or add the keys. |
| "Append-only" tables enforced by convention only | Only three tables are protected by triggers. The billing audit log, the queue log and the ledgers can be changed by anyone with database access. | Chapters 26, 27 | Low | Add triggers to the money tables. |
| Jobs and statistics that use the server clock | The month-end payroll month, credit expiry, daily summary, "this month" prescription counts, the lab catalog price day (fixed to one time zone) and the leave year follow the server, not the location. Wrong around midnight for locations in other zones. | Chapters 38, 62 | Medium | Move jobs to the location clock or document the server zone. |
| The web app computes some appointment ranges in the browser time zone | The server uses the location time zone, so a user in another zone sees shifted times. | Chapter 29 | Low | Use the location zone in the web app. |
| Location defaults of UTC and USD while organizations default to Asia/Karachi and PKR | A new branch created without explicit values gets different defaults from its clinic. | Chapters 1, 9, 14 | Low | Make new locations inherit the clinic's values. |
| Concurrent patient imports are blocked only inside one process | With several API instances two imports can run at once. | Chapter 28 | Low | Use a database lock. |
| Registration compares phone numbers exactly, import compares normalised numbers | The same number typed two ways can create two patients. | Chapter 28 | Low | Normalise in both. |
| Queue policy values apply within about a minute, and per process | The screen says changes apply tomorrow. Only the smart-queue switch is fixed per day. Another instance can use old values for up to a minute. | Chapter 30 | Low | Correct the screen text. |
| Check-in lookup and no-show job: write through GET and silent SQL | One read endpoint creates a session. The no-show job writes no queue event. | Chapter 30 | Low | Log the event. |

The two High rows deserve attention first because they stop core work. The patient-number problem appears after the first deletion in any clinic. The prescription-number problem appears as soon as a second clinic writes a prescription in the same year.

## 65.6 Unverified behaviour

These items could not be confirmed from code reading, and a real run is needed.

- Whether the foreign-key mismatches in inventory (Section 65.5) make stock movements, purchase orders and goods receipts fail at run time. Chapter 39 labels three features Unverified for this reason.
- Whether the prescription change-history read fails because it asks for a relation that is not declared, and whether duplicating a prescription fails on the doctor foreign key. Chapter 32.
- Whether background jobs keep running while a clinic is read-only. The read-only rule is an HTTP guard, so the answer is probably yes. Chapter 53.
- Whether a local PostgreSQL without SSL works with the connection settings. Chapter 7.
- Which account type to create in User Admin for a person who works only for a lab, and the exact sequence a super admin must follow to create an owner login for a clinic created from the Organizations screen. Chapters 41 and 46.
- Whether storage settings make uploaded patient documents and prescription PDFs publicly readable by address. Chapters 28 and 32.

## 65.7 Documentation drift

Several older documents describe a Platform that no longer exists. The outdated ones should not be used. Chapter 68 lists each conflict with evidence. The gaps that matter for planning are these.

| Gap | Why it matters to an owner | Evidence | Severity | Suggested next step |
|---|---|---|---|---|
| The root project instructions describe a frontend layout, a four-guard chain, "stub" modules and path-prefix skips that the code does not have | A new developer or an AI assistant that follows them will look in the wrong places. | Chapters 4, 5, 8 | Medium | Update the instructions file to match the code. |
| Five historical documents (hand-off note, project overview, audit, plan and the old billing context pack) are outdated | They list fixed problems as open and built features as missing. | Chapter 68 | Medium | Archive them or mark them superseded by this handbook. |
| The first inventory of the documents marked recall, feedback and referral as implemented through a CRM tab | The tab is never mounted. This handbook corrects that to Partial. | Chapters 28, 68 | Low | Use the handbook as the source of truth. |
| Some screen texts claim behaviour that does not exist (starting a patient plan from a template, queue settings applying "from tomorrow", a lab access panel saying a link expires after a day) | Staff are told something false. | Chapters 30, 33, 40 | Low | Correct the texts. |
| The generated data-model catalog has two known defects (shifted notes for ten inventory tables, a false trigger claim on form schema versions) | Anyone reading the catalog directly can be misled. | Chapters 23, 26 | Low | Fix the generator. |

Documentation drift is Medium at worst, but it compounds: every wrong document is a future wrong decision.

## 65.8 What to do first

The gaps fall into a clear order. First fix the two High data-integrity gaps (patient numbers after deletion and per-organization prescription numbers), because they break core work and will appear in normal use. Second, write down the deploy procedure, because it is the only High gap that is not a code defect. Third, finish the half-built flows that cost clinics time: the inventory sidebar entry, the unapply action, the payroll buttons and the lab portal forms. Fourth, remove or wire the settings that imply protection, such as the legacy organization settings and the blacklist flag. Everything else is roadmap work that depends on the answers in Chapter 67.
