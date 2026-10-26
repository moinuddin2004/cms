# Handbook Writing Guide (binding for every chapter)

This guide is for everyone, human or AI, who writes a chapter of the System Owner's Handbook.

**Read first:**
- `docs/handbook/OUTLINE.md`: the approved scope.
- `docs/handbook/INVENTORY.md`: which existing docs are trustworthy, known conflicts, and which images may be used.

---

## 1. Hard rules

1. **Do not change anything outside `docs/handbook/`.** That means no application code, config, dependencies, schemas or migrations. Read anything; write only your assigned files plus your `work/` files (section 9).
2. **Install nothing.** The only approved download-capable command is the diagram renderer, `bash docs/handbook/tools/render.sh`, which uses an already-cached package. Do not run the app, the tests or a database.
3. **The code is the source of truth.** If an existing document disagrees with the code, follow the code and record the conflict in `work/conflicts/<your-file>.md`.
4. **Never invent behaviour.** Every feature gets exactly one status label:
   - `[Implemented]`: built end to end. The backend endpoint and logic exist, and a web screen uses it, or it is a backend-only job by design.
   - `[Partial]`: some of it exists. Say exactly what is missing (for example "backend only, no screen calls it" or "no sidebar entry").
   - `[Not implemented]`: planned, seeded, commented out or only mentioned. Never describe it as working.
   - `[Unverified]`: you could not confirm it from the code. Say what you could not confirm.
5. **Exclude sensitive content.**
   - No secrets, environment variable values, credentials, tokens, internal or claude.ai URLs, IP addresses, local file-system paths outside the repo, or real or realistic personal data.
   - Name environment variables by name and purpose only.
   - For people in examples, use obviously fictional names: "Sample Patient A", "Dr. Example One", "Receptionist R1", "Example Dental Lab", "Example Clinic", "Main location" / "Second location".
   - No phone numbers, emails or CNICs, even fake-looking ones.
6. **Security findings** go only to `work/conflicts/<your-file>.md` under a "Security" heading, at category level, with no exploit detail. They never go into chapter text.
7. **Product name.** Always "**the Platform**". Never MedTrackr or DentalFlow, except once when explaining that a screenshot shows a former working name. Each clinic sets its own display name; the default is "Clinic Portal".

## 2. NotebookLM rules (each chapter must work on its own)

- **Open every chapter with 2–3 sentences of context:** what this is, who it is for, how it fits the Platform.
- **Never write** "as mentioned above", "see previous section", "as we saw", "below" or "earlier". If a fact is needed, restate it briefly. You may name another chapter, for example "(the Billing chapter, Chapter 34, covers payment allocation in full)", but the sentence must make sense without it.
- **Every image and diagram** gets:
  - a figure number,
  - an italic caption line,
  - a full paragraph that describes everything the figure shows: boxes, arrows, states, labels.
  Never let an image carry information alone.
- **Every table** is followed by a short prose paragraph that explains what it shows.
- **No source-code dumps.** A snippet of at most 8 lines is allowed only when it is the clearest way to explain a rule.
- **Write in clear English.** Use short sentences, active voice and plain words. The reader is a software engineer who owns the product: give the business meaning first, then the technical detail.
- **Use exactly the canonical names in section 7.** If you need a new term, add it to your glossary file (section 9) and use it the same way everywhere.

## 3. Files and numbering

| Part | Folder | Files (chapter number in the name) |
|---|---|---|
| 1 Product overview | `src/part1-product/` | `ch01-what-the-platform-is.md`, `ch02-roles.md`, `ch03-a-day-in-the-clinic.md` |
| 2 How it is built | `src/part2-architecture/` | `ch04-repository-and-stack.md`, `ch05-request-lifecycle.md`, `ch06-processes-and-deployment.md`, `ch07-running-locally.md` |
| 3 Tenancy, roles, permissions | `src/part3-tenancy/` | `ch08-multi-tenant-model.md`, `ch09-organizations-and-locations.md`, `ch10-features.md`, `ch11-roles-and-permissions.md` |
| 4 Data model | `src/part4-data-model/` | `ch12-data-model-overview.md`, `ch13-identity-and-sessions.md`, `ch14-organizations-locations-subscriptions.md`, `ch15-access-and-features.md`, `ch16-staff-and-payroll.md`, `ch17-patients.md`, `ch18-appointments-queue-encounters.md`, `ch19-prescriptions-and-plans.md`, `ch20-billing-core.md`, `ch21-billing-ledgers-and-closing.md`, `ch22-compensation.md`, `ch23-inventory.md`, `ch24-notifications.md`, `ch25-labs.md`, `ch26-workflow-engine-and-common.md`, `ch27-overlaps-and-ambiguities.md` |
| 5 Modules | `src/part5-modules/` | `ch28-patients.md`, `ch29-appointments.md`, `ch30-queue.md`, `ch31-consultation.md`, `ch32-prescriptions.md`, `ch33-treatment-plans.md`, `ch34-billing.md`, `ch35-commissions.md`, `ch36-dashboard-and-reports.md`, `ch37-employees.md`, `ch38-payroll.md`, `ch39-inventory.md`, `ch40-dental-lab.md`, `ch41-lab-portal.md`, `ch42-lab-finance.md`, `ch43-workflow-engine.md`, `ch44-notifications.md`, `ch45-subscriptions-and-onboarding.md` |
| 6 Workflows | `src/part6-workflows/` | `ch46` … `ch55` (one workflow each) |
| 7 Cross-cutting | `src/part7-cross-cutting/` | `ch56-authentication.md`, `ch57-access-control.md`, `ch58-customization.md`, `ch59-notification-mechanics.md`, `ch60-audit-logging.md`, `ch61-error-handling.md`, `ch62-time-money-numbering.md`, `ch63-realtime-and-jobs.md` |
| 8 Status | `src/part8-status/` | `ch64` … `ch68` |
| Appendix | `src/appendix/` | `appA` … `appE` |

**Headings:**
- `# Chapter 28 — Patients` (exactly one H1 per file).
- Sections: `## 28.1 What this module is for`.
- Features: `### 28.3.4 Import patients from a spreadsheet`.

**Figures:**
- Numbered per chapter: Figure 28.1, 28.2, … in order of appearance. Diagrams and screenshots share one sequence.

## 4. Figures: exact format

Image paths are relative to the chapter file, so from `src/partN-*/` they start with `../../assets/`.

**Existing screenshot.** Only these six may be used. All were captured on 2026-10-23 in dark theme and show the former working name "MedTrackr" in the corner. Say so once in the caption paragraph.

| File in `assets/screenshots/` | Shows |
|---|---|
| `roles-editor.jpg` | Role editor for a custom role: None/Basic/Full per module, Advanced, tabs Permissions / Home page / Members |
| `no-access-page.jpg` | "No access" page, Roman-Urdu headline, button to home page; restricted sidebar |
| `profit-loss-report.jpg` | Profit & loss report, all values zero |
| `lab-order-detail.jpg` | Lab order LAB-0001, status Submitted, one zirconia crown item, lab vs patient price, Lab access panel |
| `my-queue-picker.jpg` | "My queue" page showing only the doctor-queue picker, "Visit completed" toast |
| `hygienist-dashboard.jpg` | Dashboard as a restricted custom role (sidebar: Dashboard, Patients, Appointments). The dashboard layout predates the 2026-10-23 redesign; use only to illustrate the restricted sidebar |

Format:

```markdown
![Figure 57.3 — The no-access page](../../assets/screenshots/no-access-page.jpg)

*Figure 57.3 — The no-access page shown when a role lacks the page's permission.*

<full paragraph describing everything visible and what the user can do>
```

**Placeholder (every other screen).**
1. Create it:
   ```bash
   python docs/handbook/tools/placeholder.py ch28-patient-list "Patient list" "/patients"
   ```
2. Embed `../../assets/placeholders/ch28-patient-list.svg`.
3. Caption: `*Figure 28.2 — Patient list (screenshot pending).*`
4. Follow it with a paragraph describing what the screen contains and what the user can do, **taken from the web-app components**, so the text is useful without the picture.

**Diagram.**
1. Write Mermaid source to `diagrams/chNN-<slug>.mmd`.
2. Render it:
   ```bash
   bash docs/handbook/tools/render.sh chNN-<slug>
   ```
3. Embed `../../assets/diagrams/chNN-<slug>.png`.

**Never embed Mermaid code in chapter text.** Diagram rules:
- **State diagrams:** `stateDiagram-v2` with `direction LR`. One state diagram per lifecycle. Use the code's real state names. Label every transition with the action or endpoint that causes it.
- **Sequence diagrams:** `sequenceDiagram`. Use `autonumber` only if `showSequenceNumbers` is not enough. At most 8 participants and about 25 messages; split longer flows into two diagrams. Participant names are canonical names, for example `Receptionist`, `Web app`, `API`, `QueueOrchestrator`, `PostgreSQL`.
- **ER diagrams:** `erDiagram`. At most about 12 entities per diagram (split if larger). Use the real table names. Show only PK, FKs and 2–4 key columns per table. Relationship labels are short verbs. Logical (no-FK) links are drawn with dotted lines (`..`) and marked in the text.
- **Flowcharts:** `flowchart LR`, at most about 15 nodes.
- **Text safety:**
  - Quote labels that contain spaces or punctuation: `A["Queue entry"]`.
  - Avoid `;`, `#`, `{}` and parentheses in unquoted text.
  - No HTML apart from `<br/>`.
- **Check every render.** If `render.sh` prints FAIL, fix the source until it prints OK. Then open the PNG and check it is readable and not too tall: a diagram more than 3× taller than wide must be re-laid out (LR, split).

## 5. Module chapter template (Part 5)

```
# Chapter NN — <Module>
<2–3 sentence context>

## NN.1 What this module is for
Plain language; who uses it (canonical role names); where it appears in the sidebar
(label, from web-app/src/features/access/nav/nav.registry.ts) or "no sidebar entry".

## NN.2 Screens
One figure per screen (screenshot or placeholder) + caption + paragraph.

## NN.3 Features
### NN.3.k <Feature name as the user would say it>
**Status:** [Implemented]

**What it does.** …
**How the user does it.** numbered steps naming the real buttons/labels from the UI code.
**Behind the scenes — in simple terms.** …
**Behind the scenes — technically.** endpoint(s), service, transaction, events, jobs.
**Rules and validations.** bullet list (limits, required fields, state guards, uniqueness).
**Who can do it.** permission key(s) and scope, the feature key, and which of the
  5 system role templates hold it by default (Admin, Doctor, Receptionist, Assistant, Accountant).
**Data read and written.** tables.
**Effects on other modules.** …
**Error cases.** user-visible message or error code → when it happens.
**Technical references:** `backend/src/...` · `SymbolName` · `web-app/src/...` (one line)

(Every feature in the module, one by one: every endpoint group and every screen action.
 Small read-only endpoints can be folded into the feature they serve.)

## NN.4 Entities and data model
ERD figure + every relationship explained in words ("Each queue entry belongs to exactly one
queue session; deleting a session deletes its entries (ON DELETE CASCADE)").

## NN.5 Status lifecycles
One state diagram per lifecycle + paragraph walking through every state and transition.

## NN.6 Connections to other modules
## NN.7 Limitations and known gaps
## NN.8 Owner's FAQ
5–10 Q&A an owner would ask ("What happens if…", "Can a receptionist…", "Where is … stored?").
```

## 6. How to research a module

- **Backend.** Read:
  - controllers (endpoints and decorators: `@Can`, `@AnyMember`, `@Public`, `@ContextFree`, `@RequireSuperAdmin`, `@RequireFeature`),
  - services (rules, transactions),
  - entities (columns and constraints),
  - DTOs (validation),
  - enums and transition maps,
  - jobs (`@Cron`, `@Interval`),
  - listeners.
- **Permissions:** `backend/src/access/catalog/permissions.ts`.
- **Role templates:** `backend/src/access/catalog/templates.ts`.
- **Features:** `backend/src/feature-flags/feature-catalog.seed.ts`. Keys that are commented out are `[Not implemented]`.
- **Frontend.** Read:
  - `web-app/src/routes/*.tsx` (route, `staticData.can`),
  - `web-app/src/features/<name>/` (pages, components, hooks, services),
  - the sidebar `web-app/src/features/access/nav/nav.registry.ts`.
- **Data model:** `backend/docs/data-model/ENTITY_CATALOG.md` is reliable, with two known defects:
  - The "Notes" column of the 10 inventory tables is shifted one row down.
  - A note on `form_schema_versions` claims a trigger that does not exist.
- **Existing docs** may be used only as hints, after checking them. Trust levels are in INVENTORY.md §2:
  - `backend/docs/modules/01-organizations-locations.md` is trustworthy.
  - `docs/access-control/README.md` is current, except that `/me/catalog` is really `/access/catalog`.
  - `docs/appointments-and-queue.md` is mostly current. Its migration notes are wrong, and the worker must run exactly once.
  - `docs/commissions.md` is mostly current. It omits tax pro-rating, the lab-cost basis and lab-line commissions, and the code uses permissions, not roles.
- **Known facts to respect:**
  - OAuth is disabled (not registered).
  - There are 5 global guards: JWT → TenantContext → FeatureFlag → Access → Subscription.
  - `/inventory` has no sidebar entry.
  - `/financial-summary` redirects to `/dashboard`.
  - The dashboard was redesigned on 2026-10-23.
  - Notifications are in-app only.
  - `chairs` is entity-only.

## 7. Canonical names (use exactly these)

**the Platform** · **organization** (one clinic business; the tenant) · **location** (a branch) · **super admin** · **owner** · **employee** (the person record) · **assignment** (an employee's link to an organization and location with an employment role) · **role** (an employment role; "system role" for the 5 templates: Admin, Doctor, Receptionist, Assistant, Accountant; "custom role") · **staff login** (a user account for an employee) · **permission** (e.g. `billing.invoice.void`) · **scope** (`own` / `location` / `org`) · **feature** (a feature key, e.g. `billing.invoices`) · **entitled** (super admin grants) · **enabled** (owner switches on) · **location override** (switch off per location) · **access version** · **patient** · **appointment** · **queue session** (one doctor's queue for one clinic day) · **queue entry** · **token** · **walk-in** · **encounter** (the clinical record of one consultation) · **consultation workspace** · **treatment** (work performed) · **treatment plan** (planned work) · **plan template** · **prescription** · **medicine directory** · **charge** · **invoice** · **payment** · **allocation** · **refund** · **advance** (unallocated patient money) · **discount type** · **payment account** · **cash close** · **compensation plan** · **commission rule** · **commission entry** · **settlement** · **payroll record** · **lab** · **lab link** (clinic↔lab connection) · **lab order** · **lab order item** · **magic link** · **lab portal** · **lab member** (lab admin / lab technician) · **patient lab invoice** · **vendor bill** · **lab statement** · **workflow template** · **form schema** · **stage template** · **notification event** · **notification rule** · **subscription status** · **read-only mode** · **Config Studio**.

If the UI label differs from the code name, use the UI label in prose and give the code name once in Technical references.

## 8. Style details

- Money: "PKR" is the default currency, not a limit. Amounts are stored in paisa (integer minor units) or as numeric columns; say which.
- Time: clinic dates and times follow the **location's** timezone.
- Endpoints: write them as `POST /queue/walk-ins`, without the API base URL.
- Mention job schedules in clinic-neutral terms ("every day at 02:30 server time"). Check whether the cron uses the server timezone or the location's and say which.
- Do not write "simply", "just" or "obviously".

## 9. Your outputs besides the chapter

Use one file per chapter file you own, named after it (e.g. `ch28-patients.md`):

- `work/glossary/<file>.md`: every new term you define, as `- **Term** — definition (code name if different).`
- `work/status/<file>.md`: one Markdown table row per feature:
  `| Chapter | Feature | Status | One-line note |`
- `work/conflicts/<file>.md`: doc-vs-code conflicts (doc, claim, code reality, evidence), oddities, and a "Security" heading if needed (category level only).
- `work/reports/<file>.md`: a 10-line hand-back that lists:
  - figures made (count, and how many placeholders),
  - diagrams that failed to render, if any,
  - anything you could not verify.
