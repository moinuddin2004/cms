> **ARCHIVED — historical session handoff, not current.** Paths, dates and next-task notes are out of date. See `CLAUDE.md`.

# Session Handoff — Medical CMS (Dec 2026)

## Where you're picking up

User just shipped a large multi-module build over one long autonomous session. **Last unfinished thing:** the new Prescription module's three admin pages (`/medicine-directory`, `/treatment-plan-templates`, `/prescription-templates`) exist and work but **are not discoverable in the UI** — only the main "Prescriptions" item is in the sidebar. User asked "prescription ky template aur treatment plan kaha se save karo" (where do I save prescription templates and treatment plans). Half-edit was reverted; nothing to clean up.

**Next concrete task:** surface the three admin pages from the Prescriptions list page header (a "Templates & Library" dropdown is the cleanest spot — sidebar would be cluttered). Also add a discovery hint on the builder when no template exists.

---

## Critical user preferences (in memory — read those files)

`C:\Users\levo\.claude\projects\D--code-cms\memory\` contains 4 memory files. Most load-bearing for this user:

- **autonomous build style** — Multi-step builds run end-to-end **in main branch**, no mid-build check-in questions, no AskUserQuestion. Decide design forks yourself; flag deferrals in the wrap-up. They literally said "complete the full feature dont ask me anything and do all thing in main brach".
- **feature-flag gating** — Org features must be enforced at 3 layers: backend `@RequireFeature`, sidebar nav item with `feature:` key, route wrap with `<RequireFeaturePage>`. Use these on every new feature-gated surface.
- **swappable providers** — Cloudinary, SMS, etc. behind a `StorageProvider`-style interface.

User language: Urdu/English mix ("Roman Urdu"). Don't translate — just understand. Examples: "kaha se save karo" = where to save, "naam bhi na ho" = the name shouldn't even appear, "sahi karo" = fix it.

---

## What was built in this session

### 1. Patient module fixes
- Consent enum mismatch (frontend `general_treatment` vs backend `treatment`) — backend enum rewritten to dental categories
- Treatment-plan progression — backend `PATCH .../items/:itemId` + frontend status dropdown + session counters + accept-plan button
- Teeth chart — per-tooth notes saved in `chartData`, anatomically-shaped SVG teeth (molars 3 roots, premolars 2, canines pointed, incisors chisel) with upper/lower orientation flipped
- Vitals — surfaced "Latest Vitals" card on Overview tab, expanded the form (SpO₂, notes)
- Print utility for prescriptions & consent receipts
- Consent signature error: was Cloudinary `api_key` missing; switched to inline `data:` URL (backend `body parser` limit bumped to 5 MB)
- Hid CRM tab, stripped Admin → Files-only

### 2. Appointment module overhaul
- Fixed month-view "stuck at March" bug — `datesSet` was writing `dateInfo.start` (grid leading edge) instead of `view.currentStart` (actual month)
- Day/Week now 24-hour grid, `scrollTime="08:00:00"`
- Default view = List (was Calendar)
- New `AppointmentsList` with debounced search (patient name/phone/patient #/**token**), filters, date presets (Today/Upcoming/Past 30/All/Custom), pagination
- Token number per location per day — backend `nextTokenNumber()` via `MAX(token_number)+1`, displayed on list + calendar + detail
- Printable receipt — big centered token, patient/doctor/date
- `AppointmentDetailModal` — read-only "doctor's view" with quick status actions, "View patient" link, "Print receipt"; opened by default from list/calendar (Edit promoted to existing modal)

### 3. Payroll scheduler + CRUD
- Cron `0 5 1 * *` — month-end scheduler enumerates all active locations across all orgs, generates payroll for previous month; idempotent via unique constraint
- Manual `POST /payroll`, `PATCH /payroll/:id`, `DELETE /payroll/:id` + Create/Edit modal with notes + employee dropdown auto-fills salary
- `payroll_records.created_by` made nullable (for system-generated rows)

### 4. Feature-flag system properly enforced (was previously catalog-only)
- Created `<RequireFeaturePage>` component (`cms/web-app/src/components/feature/RequireFeaturePage.tsx`) — shows "feature not available" page when off
- Sidebar items got `feature:` keys + filtered by `useFeatures()`
- Backend: added `@RequireFeature` to `patients`, `appointments`, `payroll`, `leave` controllers (was only on billing + inventory)
- Patient tabs (`teeth_chart`, `treatment_plans`, `prescriptions`, `documents`) wrapped in `<FeatureGuard>`

### 5. **Prescription module (the big one — 23 steps, ~50 files)**

**Backend** — new module at `cms/backend/src/prescriptions/`, registered in `app.module.ts`. **Coexists with legacy `patient_prescriptions` table** — doesn't replace it. New table is `prescriptions`.

- 8 entities: `medicine_directory`, `prescription_templates`, `treatment_plan_templates` (+ medicines child), `prescriptions` (+ medicines child), `doctor_signatures`, `prescription_history`
- 5 enums: `MedicineType`, `MealRelation`, `PageSize/Orientation`, `PrescriptionStatus`, `PrescriptionHistoryChangeType`
- 7 services: MedicineDirectory (with `seedCommonMedicines` for 10 common Pakistani-pharmacy meds), PrescriptionTemplate (default-per-location with org-wide fallback), TreatmentPlanTemplate (replace-all medicines pattern in transaction), DoctorSignature (upsert one-per-doctor), Prescription (create-with-template-seed, line ops, finalize, duplicate, by-patient/by-appointment, stats), PrescriptionPdf (pdf-lib), PrescriptionHistory (audit + snapshot helper)
- 5 controllers all `@RequireFeature('patients.prescriptions')`
- DTOs cover everything with class-validator

**Frontend** — at `cms/web-app/src/features/prescriptions/`:
- Types mirror backend enums
- API service + 7 hooks (one per resource)
- `MedicineAutocomplete` — debounced search dropdown with free-text fallback
- `PrescriptionPreview` — live HTML/CSS rendering matching printed PDF, **bilingual** (English + Urdu RTL via Noto Nastaliq from Google Fonts)
- `PrescriptionBuilder` — split-screen page: left editor (patient picker, complaint/diagnosis, vitals, medicines list, instructions En + Ur, further plan), right live preview, sticky save bar, signature dialog with saved-signature reuse
- Routes: `/prescriptions` (list with stats), `/prescriptions/new` (search params: `patientId`, `appointmentId`), `/prescriptions/$prescriptionId`, `/medicine-directory`, `/treatment-plan-templates`, `/prescription-templates` (all gated by `RequireFeaturePage('patients.prescriptions')`)
- Sidebar: "Prescriptions" entry added
- Patient `ClinicalTab`: new builder section above the legacy quick-Rx form

---

## Critical design decisions (don't reverse these without thinking)

1. **Prescription module coexists with legacy `patient_prescriptions`** — same UX showed both; migration to be incremental.
2. **PDF library = `pdf-lib`** (already installed). NOT Puppeteer.
3. **⚠️ KNOWN LIMITATION: Urdu in PDFs renders as boxed glyphs** — pdf-lib's standard fonts don't shape Arabic script. HTML preview renders Urdu correctly (Noto Nastaliq from Google Fonts), printed PDF does not until a Nastaliq font is bundled + embedded via `@pdf-lib/fontkit`. TODO at top of `prescription-pdf.service.ts`.
4. **Signatures stored inline as `data:image/png;base64,…`** when Cloudinary isn't configured. Same pattern as consent signatures. Backend JSON body limit bumped to 5 MB in `main.ts`.
5. **Denormalized medicine fields** on every prescription/template line — directory rename/disable doesn't affect old prescriptions.
6. **Replace-all medicines pattern** for template + prescription updates (atomic via transaction).
7. **Route navigation casts** in `PrescriptionBuilder.tsx` — `(navigate as any)({...})` is intentional because TanStack Router auto-generates `routeTree.gen.ts` at vite dev/build time. First `npm run dev` regenerates the registry; casts can be removed on next refactor.

---

## Known follow-ups (not blockers, flagged honestly)

| Area | What's missing |
|---|---|
| **🔴 IMMEDIATE: Templates discoverability** | The user can't find `/medicine-directory`, `/treatment-plan-templates`, `/prescription-templates` — add a "Templates & Library" dropdown on `/prescriptions` page header, plus a "No templates? Create one →" hint on the builder when `templates.length === 0`. **This was the half-finished edit when handoff happened.** |
| Urdu PDF | Bundle Nastaliq font, embed via fontkit |
| Drag-to-reorder medicines | Sort order in data; UI uses array order only |
| Prescription history viewer | Backend logs every change; no UI panel yet |
| WhatsApp share | PDF endpoint exists; just need wrapper |
| Patient autocomplete | Duplicated logic in builder vs AppointmentModal; could DRY |
| Backend method-level @RequireFeature for patient sub-features | Only `patients.core` is enforced at API; teeth-chart/Rx/plan endpoints aren't gated by their sub-flags |
| `comms.*` and `reports.*` catalog keys | Have catalog entries but no backend controllers at all |
| Billing/appointment sub-flags | `pdf_receipts`, `insurance_claims`, `online_payments`, `appointments.reminders`, etc. — catalog entries, not enforced |

---

## Environment notes

- Backend: NestJS 11, PostgreSQL (Neon-compatible), `synchronize: true` in dev — new tables auto-create on backend restart. Production needs a migration.
- Frontend: React 19 + TanStack Start + shadcn/ui + Tailwind 4
- Cloudinary `CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET` are MISSING from `.env` — that's why I made signatures use inline data URLs. Document uploads (X-rays, etc.) won't work until those env vars are set.
- Verification: `tsc --noEmit` passes on both. I could NOT verify in-browser from this session because the app needs a logged-in org with a real database. User's `preview` MCP tool may or may not be wired to their actual app — assume not.

---

## Files-of-interest map (only the load-bearing ones)

```
cms/backend/src/
├── prescriptions/              ← NEW module, this session
│   ├── entities/  (8)
│   ├── enums/     (5)
│   ├── dto/       (4 + signature)
│   ├── services/  (7)
│   ├── controllers/ (5)
│   └── prescriptions.module.ts
├── appointments/
│   ├── entities/appointment.entity.ts          ← has tokenNumber
│   ├── appointments.service.ts                 ← nextTokenNumber(), search ILIKE
│   └── dto/appointment-filter.dto.ts           ← search field
├── payroll/payroll.service.ts                  ← @Cron('0 5 1 * *') runMonthEndPayroll
├── patients/
│   ├── enums/consent-type.enum.ts              ← rewritten to dental categories
│   └── dto/request/sub-entity.dto.ts           ← UpdatePlanItemDto
├── feature-flags/                              ← unchanged but you'll reference
└── main.ts                                     ← bodyParser limit 5mb

cms/web-app/src/
├── features/prescriptions/                     ← NEW
│   ├── components/MedicineAutocomplete.tsx
│   ├── components/PrescriptionPreview.tsx
│   ├── components/PrescriptionBuilder.tsx      ← THE main split-screen page
│   ├── hooks/  (7)
│   ├── services/prescriptions.api.ts
│   └── types.ts
├── routes/prescriptions/                       ← NEW: index, new, $prescriptionId
├── routes/medicine-directory.tsx               ← NEW
├── routes/treatment-plan-templates.tsx         ← NEW
├── routes/prescription-templates.tsx           ← NEW (with live preview)
├── routes/appointments.tsx                     ← refactored, list-default
├── routes/payroll.tsx                          ← has Create Payroll modal
├── features/appointments/components/
│   ├── AppointmentsList.tsx                    ← NEW
│   ├── AppointmentDetailModal.tsx              ← NEW
│   └── FullCalendarView.tsx                    ← bug fix + 24h grid
├── features/patients/components/tabs/
│   ├── ClinicalTab.tsx                         ← shows new + legacy Rx
│   ├── TeethChartTab.tsx                       ← anatomical SVG + per-tooth notes
│   └── VitalsAndDentalTab.tsx                  ← expanded form
├── components/feature/RequireFeaturePage.tsx   ← NEW
└── components/layout/Sidebar.tsx               ← feature-gated nav items
```

---

## How to test the prescription module (when the user comes back)

1. Restart backend → 8 new tables auto-create
2. Restart frontend → routeTree regenerates, "Prescriptions" appears in sidebar
3. `/medicine-directory` → click "Seed common" → 10 medicines populate
4. `/treatment-plan-templates` → create "Root canal aftercare" with 2-3 medicines
5. `/prescriptions/new` → search patient → Plans dropdown → apply template → live preview updates as you type → "Finalize & Sign" → signature pad → confirm
6. From patient detail → Clinical & Rx tab → "New Rx" button deep-links to builder

---

## When in doubt

The user's communication style is terse, fast-paced, often in Roman Urdu. They want execution, not deliberation. They explicitly opted into "do everything in main, don't ask." Match that energy: **flag concerns in writing, not as questions; ship the work; surface follow-ups at the end.**
