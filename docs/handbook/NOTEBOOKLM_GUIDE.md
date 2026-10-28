# NotebookLM Guide — System Owner's Handbook

This guide explains how to turn the handbook PDFs into video overviews in NotebookLM. It gives one ready-to-paste customization prompt per PDF. The PDFs are in `docs/handbook/pdf/`.

## 1. How to use the PDFs

1. Create one notebook. Upload `00-Complete-Handbook.pdf` first as the reference source. It contains everything, including the glossary, entity index, API summary, permission catalog and scheduled-jobs appendices.
2. For a focused video, **select only the one PDF you want narrated** and untick the others in the Sources panel. NotebookLM builds a video from the sources that are ticked. If the Complete Handbook is also ticked, the video may wander across modules.
3. Open Video Overview → Customize, paste the matching prompt from section 3, choose a language and generate.
4. Suggested order for a first pass: `01`, `02`, then the `10-Module-*` files in the order of a patient visit (Appointments, Queue, Consultation, Prescriptions, Billing, Dental-Lab), then `90`, `95`.

**Size check.** The Complete Handbook is about 261,000 words. NotebookLM accepts up to 500,000 words per source. Whether the file stays under the 200 MB limit is shown by the build report (`pdf/_build-report.json`).

## 2. What every prompt asks for

Each prompt below asks NotebookLM to do the same five things:

- Speak to a software engineer who owns the product and wants the business meaning first and the technical detail second.
- Cover **every feature in that source, one by one**, in the order the chapter lists them.
- Explain each diagram in words: what the boxes, arrows and states mean. Do not skip figures captioned "screenshot pending": describe the screen from the paragraph that follows the caption.
- Say each feature's status label honestly: [Implemented], [Partial], [Not implemented] or [Unverified]. Never present a partial or planned feature as finished.
- Call the product "the Platform", never read file paths aloud, and use fictional example names only.

---

## 3. Prompts

### 00-Complete-Handbook.pdf

```
Make a series-style overview of the whole System Owner's Handbook for the owner of a clinic management product, who is a software engineer. Follow the eight parts in order: product overview, how the system is built, tenancy and permissions, data model, the 18 modules, end-to-end workflows, cross-cutting concerns, and current status. Spend the most time on how the pieces fit together: tenancy, the request path from a click to the database, the queue-to-billing handoff, and the lab flow. Explain every diagram in words. State status labels honestly: out of 386 distinct features, most are [Implemented], some are [Partial], a few are [Not implemented]. Do not call partial features finished. End with the biggest gaps and risks and what to fix first. Call the product "the Platform". Do not read file paths aloud.
```

### 01-Product-and-Architecture.pdf

```
Explain what the Platform is and how it is built, for a software-engineer owner. Cover Part 1 (what the product is, every user role, a day in a clinic), Part 2 (monorepo, tech stack, the request lifecycle from a click to the database and back, processes and deployment, running locally) and Part 3 (organizations, locations, the multi-tenant model, features entitled by the super admin and enabled by the owner, roles and permissions). Walk through every diagram: the request sequence, the realtime path, the tenancy model, feature activation and access resolution. Be honest that there is no deployment or CI configuration in the repository. Mention status labels such as [Partial] or [Not implemented] when a capability is incomplete. Call the product "the Platform".
```

### 02-Data-Model.pdf

```
Explain the Platform's data model to a software engineer who owns it. Start with the overview: how the schema is created in development versus production, the three migrations, key conventions (key types, money in paisa versus numeric, soft deletes, tenant columns). Then go domain by domain through the chapters: identity, organizations and subscriptions, access and features, staff and payroll, patients, appointments and queue, prescriptions, billing, ledgers, compensation, inventory, notifications, the five lab diagrams and the workflow engine. For every entity-relationship diagram, explain each table in business terms and every relationship in words, including what happens on delete. Finish with the overlaps and ambiguities chapter: duplicate concepts, missing foreign keys and the numbering risks. Label anything unverified as [Unverified].
```

### 10-Module-Patients.pdf

```
Cover every one of the 30 features in the Patients chapter one by one: 19 are [Implemented], 9 are [Partial] and 2 are [Not implemented]. For each, say what the user does, what happens behind the scenes in simple terms and then technically, who is allowed, and what can go wrong. Include registration, the list, the detail tabs, import from a spreadsheet and export, the change history, the teeth chart, vitals, consents, documents, and the CRM records. Be clear that recalls, referrals, feedback and insurance work only in the backend because the CRM tab is never shown, that deletion fails when billing or lab records exist, and that patient numbering can collide after a delete. Explain every diagram: the status diagrams, the import flow and the scope flowchart. Describe "screenshot pending" screens from the text.
```

### 10-Module-Appointments.pdf

```
Cover all 14 features in the Appointments chapter one by one: 10 [Implemented], 2 [Partial], 2 [Not implemented]. Explain the list with walk-ins, the doctor calendar, booking with the live slot check, rescheduling, confirming, cancelling with reason codes, no-show by hand and by the 60-second job, check-in as the hand-over to the queue, and converting to a walk-in. Say plainly that booking rules override is backend only, that booking ignores doctor availability overrides and leave, and that reminders, recurring bookings and online booking are [Not implemented]. Explain the appointment status diagram, the booking sequence and the data diagram in words. Describe pending screenshots from the text.
```

### 10-Module-Queue.pdf

```
Cover all 31 features in the Queue chapter one by one: 28 [Implemented], 2 [Partial], 1 [Not implemented]. Explain queue sessions per doctor per day, tokens, walk-ins, calling the next patient, the selection engine in plain words (smart mode versus first-come), skip, rejoin, transfer, priority, send for test, start and complete consultation, the reception board, the doctor screen and the public TV display, queue policies, idempotency and version checks, realtime delivery, and the four background jobs. Explain every diagram: the session and entry lifecycles, the selection flowchart, the realtime flow and the visit sequence. Be honest about the [Partial] items (next-patient preview and event history have no screen) and the one [Not implemented] item.
```

### 10-Module-Consultation.pdf

```
Cover all 15 features in the Consultation chapter one by one: 11 [Implemented], 2 [Partial], 2 [Not implemented]. Explain how a consultation starts and creates the encounter, the patient-at-a-glance summary, auto-saved visit notes, treatments done today, the prescription panel, completing the visit, and the automatic charges raised on completion (only when billing invoices are enabled). Say clearly that creating a lab order from the workspace and SOAP notes are [Not implemented], that allergy alerts come from free text, and that the encounter is not locked after completion. Explain the start and completion sequence diagrams, the data diagram and the lifecycle in words.
```

### 10-Module-Prescriptions.pdf

```
Cover all 15 features in the Prescriptions chapter one by one: 11 [Implemented] and 4 [Partial]. Explain the list, the builder with drafts, presets, finalizing and signing, amending, the PDF with Urdu support and print layouts, doctor signatures, the medicine directory, and the older legacy prescription table that still exists. Make clear that "presets" are medicine protocols, not clinical plan templates. Be honest about the [Partial] items: single-line edits, duplicate, change history and some lookups have no screen or may fail. Explain the lifecycle diagram (draft, finalized, amended), the signing and printing sequence, the layout resolution flowchart and the data diagram in words.
```

### 10-Module-Treatment-Plans.pdf

```
Cover all 14 features in the Treatment Plans chapter one by one: 7 [Implemented], 6 [Partial], 1 [Not implemented]. Explain plan templates and where they are used (only in the record-treatment dialog), the difference between plan templates and prescription presets, patient treatment plans and items, and how plan items turn into charges. Be direct that patient treatment plans have backend endpoints but no screen, that no web code calls the plans-to-charges endpoint, and that "start a plan from a template" is [Not implemented] even though the page text suggests it. Explain the plan and item status diagrams, the plan-to-charges sequence and the data diagram in words.
```

### 10-Module-Billing.pdf

```
Cover all 34 features in the Billing chapter one by one: 31 [Implemented] and 3 [Partial]. Explain the service catalog and prices, charges (automatic from a completed consultation, manual, discounts, voiding), the billing desk, collecting payment with allocation and advance, how the invoice is issued inside the payment transaction, invoice numbering, stored versus computed status, revisions, cancellation and refunds, exclusive tax, patient statements, cash close, printing in A4 and 80 mm thermal, expenses, billing settings, activity, and the nightly invariant check. Be clear that billing invoices is off by default, that credit packages, unapplying a payment and creating charges from a treatment plan are backend only, and that an invoice with any payment cannot be cancelled from the web app. Explain every state and sequence diagram in words.
```

### 10-Module-Commissions.pdf

```
Cover all 14 features in the Commissions chapter one by one: 13 [Implemented] and 1 [Not implemented]. Explain compensation plans (salary, commission, or both), versioning without overlap, commission rules and overrides, the rate snapshot on each charge, how a commission is earned when money is collected (net or gross, tax pro-rating, lab-cost basis), lab-line commissions, the doctor share preview, doctor earnings and my earnings, settlement through payroll, and the append-only ledger with its trigger and nightly check. Say that manual adjustments are [Not implemented] and that the hr.commissions feature key gates nothing. Explain the earning sequence, the entry-to-settlement lifecycle and the plan-versions diagram in words.
```

### 10-Module-Dashboard-and-Reports.pdf

```
Cover all 9 features in the Dashboard and Reports chapter one by one: 6 [Implemented] and 3 [Partial]. Explain the main dashboard, the finance overview and profit-and-loss view (collected versus billed basis, lab bills, commissions, salaries, expenses), clinic overview, the report library, running a report and downloading Excel or PDF. Walk through the table of all 37 reports by category. Be honest that the clinic overview refuses the default Doctor role, that the daily financial summary has no screen, and that the old mock dashboard widgets are dead code no user sees. Explain the three diagrams in words and describe the pending screenshots from the text.
```

### 10-Module-Employees.pdf

```
Cover all 15 features in the Employees chapter one by one: 10 [Implemented], 3 [Partial], 2 [Not implemented]. Explain the employee person record with platform-unique phone and CNIC, assignments to an organization and location with a role, staff logins, status, salary, weekly schedules, availability overrides and leave. Be clear that assigning an existing employee to a second location and attendance tracking are [Not implemented], that booking ignores availability overrides and leave, and that duplicate CNIC returns a generic error. Explain the data diagram and the leave and assignment status diagrams in words.
```

### 10-Module-Payroll.pdf

```
Cover all 11 features in the Payroll chapter one by one: 7 [Implemented], 3 [Partial], 1 [Not implemented]. Explain the month-end job (05:00 server time on the 1st), manual generation, base salary plus commission, marking paid, editing and deleting records, the commission settlement lock and release, CSV export and payslip PDF. Be honest that on-hold, CSV export and payslip PDF exist as endpoints without buttons, that deductions, tax and bank files are [Not implemented], and that marking a record paid through the edit dialog leaves the commission settlement pending. Explain the month-end sequence diagram, the status diagram and the data diagram in words.
```

### 10-Module-Inventory.pdf

```
Cover all 10 features in the Inventory chapter one by one. Be completely honest about status: none is fully [Implemented], 6 are [Partial], 1 is [Not implemented] and 3 are [Unverified]. Explain items, categories, suppliers, purchase orders, receiving goods, stock adjustments and movements, consumption templates, and the daily alert job that only writes a server log. Say plainly that the inventory page has no sidebar entry and is reachable only by its address, that recording materials used on a patient has no screen, and that some writes may fail because a user id is stored in an employee foreign-key column. Explain the stock flow, purchase-order status and data diagrams in words.
```

### 10-Module-Dental-Lab.pdf

```
Cover all 30 features in the Dental Lab (clinic side) chapter one by one: 26 [Implemented] and 4 [Partial]. Explain the lab directory and clinic-lab links, the lab price list and service mappings, order templates, creating and submitting lab orders, revisions, messages and attachments, magic links and acting on behalf of a lab, production and try-in rounds, approving, rejecting and delivering items, remakes and who pays, shipments, and notifications. Explain that order, item and stage states come from workflow data and that four notification events are never emitted. Explain every state diagram (order, item, stage, shipment, remake, link) and the data diagrams in words.
```

### 10-Module-Lab-Portal.pdf

```
Cover all 27 features in the Lab Portal chapter one by one: 24 [Implemented] and 3 [Partial]. Explain how lab members sign in (lab admin and lab technician), the portal screens (orders, production, billing, clinics, team, profile), accepting, rejecting and asking questions on an order, acknowledging revisions, production steps, shipments, remake disputes, and the magic-link pages that work without a login. Say that a magic-link-only lab can accept, reject or ask a question but cannot run production, and that extra-charge requests, file uploads and a notification inbox are missing from the portal. Explain the end-to-end sequence diagram and the magic-link status diagram in words.
```

### 10-Module-Lab-Finance.pdf

```
Cover all 21 features in the Lab Finance chapter one by one: 17 [Implemented] and 4 [Partial]. Explain the patient lab invoice (draft estimate, issue, void, advance, credit notes, payments, reversals, refunds), vendor bills drafted when a lab accepts, vendor payments and allocations, lab statements and reconciliation, the lab reports (aging, monthly cost, case profit), lab-line commissions and the ledger. Be honest that invoice reminders are queued but the patient channel is off by default, that journals are written but no screen reads them, and that some vendor-bill actions exist only in the API. Explain every state diagram and the money sequence diagram in words.
```

### 10-Module-Workflow-Engine.pdf

```
Cover all 12 features in the Workflow Engine (Config Studio) chapter one by one: 11 [Implemented] and 1 [Partial]. Explain that this is a super-admin-only area. Cover specialties, versioned workflow templates with states, transitions and effects, stage templates, versioned form schemas with validation, publishing and retiring versions, and how a lab order pins a published workflow version and then runs its transitions. Say that specialties can be created through the API but Config Studio only lists them. Explain the version lifecycle diagram, the pin-and-run flowchart and the data diagram in words.
```

### 10-Module-Notifications.pdf

```
Cover all 12 features in the Notifications chapter one by one: 7 [Implemented], 3 [Partial], 2 [Not implemented]. Explain the bell and inbox, marking read, how an event is raised, background delivery through the outbox, rules and audiences, wording templates, and the message log. Be honest that only in-app delivery works, that only lab and lab-payment events exist, that quiet hours are saved but never hold in-app messages, that patient opt-outs have no screen, that four seeded events are never emitted, and that patient WhatsApp, SMS, email and appointment reminders are [Not implemented]. Explain the delivery sequence, outbox status and read-state diagrams in words.
```

### 10-Module-Subscriptions-and-Onboarding.pdf

```
Cover all 10 features in the Subscriptions and Onboarding chapter one by one: 8 [Implemented] and 2 [Partial]. Explain self-signup, email verification, the setup wizard, plans and limits, the 14-day trial, the derived subscription status (unmanaged, trialing, active, grace, expired), read-only mode when expired, the clinic subscription page, and how the super admin records manual payments. Be honest that email verification gates nothing and that the plan selector on the Organizations screen sends values the API rejects. Explain the signup sequence diagram, the subscription status diagram and the onboarding flag diagram in words.
```

### 80-Cross-Cutting.pdf

```
Explain the Platform's cross-cutting concerns to a software-engineer owner, chapter by chapter: authentication (sessions, tokens, password flows, OAuth being disabled), access control in depth (the five guards, decorators, scopes, the coverage test), customization (features admin, roles builder, sidebar builder, theme cascade), notification mechanics, audit logging (what is and is not logged today), error handling, time, money and numbering, and realtime and background jobs. Explain every diagram in words. Be honest that audit coverage is partial, there is no organization-wide audit viewer or retention policy, there is no database row-level security, and several numbers can collide. Use status labels throughout.
```

### 90-End-to-End-Workflows.pdf

```
Narrate the ten end-to-end workflows one by one for a software-engineer owner: clinic onboarding, staff onboarding, the patient journey, the dental lab case, daily clinic closing, month-end payroll, invoice correction and refund, subscription expiry and recovery, access-change propagation, and purchase to consumption. For each, explain who is involved, the numbered steps, what can go wrong and what data is left behind, and walk through its sequence diagram message by message. Mark every step with its honest status label, especially where a step is [Partial], [Unverified] or [Not implemented], such as lab orders from the consultation workspace and the inventory chain. Do not skip the "what can go wrong" sections.
```

### 95-Status-and-Gaps.pdf

```
Give an honest state-of-the-product briefing to the owner. Walk through the feature status matrix and its totals, then the known gaps grouped as not built, built but unreachable from the screens, seeded but inert, and data-integrity oddities, with severity and suggested next steps. Cover the risks (data model, operational, observations about retention and audit, and security at category level only), the open questions that need the owner's decision, and where older documents disagree with the code. Do not soften anything: say "[Partial]" or "[Not implemented]" wherever the chapter does. End with a clear recommendation of what to fix first.
```

---

## 4. Tips

- **Keep prompts short.** NotebookLM accepts long customization text, but results are best when the prompt names the audience, the coverage rule and the honesty rule, as above.
- **Splitting the Complete Handbook.** If a video of the Complete Handbook is too shallow, generate it part by part instead, using `01`, `02`, the module files, `80`, `90` and `95`. Together they carry the same content.
- **Screenshots.** Most figures are placeholders because only a few usable screenshots exist. The text after each caption describes the screen from the code. When you recapture screenshots, rebuild with `node docs/handbook/tools/build-pdf.mjs`.
- **After code changes.** The handbook describes the code as of 2026-10-28. The chapter status labels and counts will drift as the Platform changes.
