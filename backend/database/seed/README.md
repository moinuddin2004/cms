# Seed data (demo / QA database)

Fills an **empty** database with a realistic demo: a super admin, three
clinics (two dental, one general), their staff with logins, ~38 patients
(names in English and Urdu), about two months of clinic history —
appointments, queue tokens, consultations, treatments, treatment plans,
prescriptions, invoices and payments, lab orders, stock — plus bookings for
the next two weeks. Built for dev / QA / demos. **Never run it on production.**

Everything is created through the app's own services (the same code the API
runs), so numbers, ledgers, audit trails and queue history are real.

## Run it

From `backend/`, on an empty database (schema only):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f database/schema/00_reset_public_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f database/schema/run_all.sql
npm run seed
```

(In DataGrip / pgAdmin: run `schema/00_reset_public_schema.sql` — it wipes
everything — then `01 → 05`, then `npm run seed`.)

- Uses `DATABASE_URL` from `backend/.env` (or `SEED_DATABASE_URL`). On Neon
  it switches to the direct host (not `-pooler`) by itself.
- Refuses to run when organizations already exist (`--force` to override).
- Takes roughly 30–40 min on a hosted database like Neon (~100 ms per
  query); most of it is the day-by-day visits, which run one process per
  clinic in parallel. On a local Postgres it is a few minutes.
- Sends nothing: SMTP and Redis are switched off for the run. Notifications
  are only written to the database.

### Try it without touching your data

```bash
npm run seed:check
```

Builds the whole schema in a throw-away Postgres schema `seedcheck` inside
the same database, runs the seed into it, prints row counts per table and
drops it. `public` is never read or written. `--keep` leaves it for
inspection (drop later: `DROP SCHEMA seedcheck CASCADE`).

### Options (env)

| Variable | Default | |
|---|---|---|
| `SEED_HISTORY_DAYS` | `60` | how many days of history |
| `SEED_ONLY` | all | `visits`, `billing`, `labs`, `inventory` — core steps + only these groups |
| `SEED_PARALLEL` | on | `0` = visits in one process (slower, easier to debug) |

## Logins

Password for **every** login: **`Seed@12345`**. All emails are on the
reserved `.test` domain (mail to them can never be delivered).

| Clinic | Role | Name | Email |
|---|---|---|---|
| — | Super admin | Platform Admin | `superadmin@seed.test` |
| Smile Care Dental Clinic (Karachi) | Owner + dentist | Dr. Kamran Siddiqui | `owner@smilecare.seed.test` |
| | Admin (manager) | Zainab Hussain | `manager@smilecare.seed.test` |
| | Doctor — orthodontist | Dr. Ayesha Malik | `dr.ayesha@smilecare.seed.test` |
| | Doctor — endodontist (both branches, commission) | Dr. Bilal Ahmed | `dr.bilal@smilecare.seed.test` |
| | Doctor — general dentist (Gulshan) | Dr. Sana Tariq | `dr.sana@smilecare.seed.test` |
| | Doctor — oral surgeon (visiting, commission) | Dr. Usman Raza | `dr.usman@smilecare.seed.test` |
| | Receptionist (Clifton) | Hina Shah | `hina@smilecare.seed.test` |
| | Receptionist (Gulshan) | Mehwish Iqbal | `mehwish@smilecare.seed.test` |
| | Assistant (Clifton) | Farhan Ali | `farhan@smilecare.seed.test` |
| | Assistant (Gulshan) | Rabia Noor | `rabia@smilecare.seed.test` |
| | Accountant | Imran Qureshi | `accounts@smilecare.seed.test` |
| Al-Shifa Dental & Implant Centre (Lahore) | Owner | Nadia Chaudhry | `owner@alshifa.seed.test` |
| | Admin | Sobia Khan | `manager@alshifa.seed.test` |
| | Doctor — implantologist | Dr. Hassan Javed | `dr.hassan@alshifa.seed.test` |
| | Doctor — general dentist (commission) | Dr. Faisal Butt | `dr.faisal@alshifa.seed.test` |
| | Doctor — paediatric dentist (part-time) | Dr. Maryam Akhtar | `dr.maryam@alshifa.seed.test` |
| | Receptionist | Saima Riaz | `reception@alshifa.seed.test` |
| | Assistant | Waqas Ahmad | `waqas@alshifa.seed.test` |
| | Accountant | Tahir Mehmood | `accounts@alshifa.seed.test` |
| Shifa Family Clinic (Islamabad, general) | Owner + family physician | Dr. Asif Mehmood | `owner@familycare.seed.test` |
| | Doctor — gynaecologist | Dr. Fatima Zahra | `dr.fatima@familycare.seed.test` |
| | Doctor — paediatrician (visiting, commission) | Dr. Omer Farooq | `dr.omer@familycare.seed.test` |
| | Receptionist | Nida Pervaiz | `reception@familycare.seed.test` |
| | Nurse (assistant role) | Shazia Bibi | `nurse@familycare.seed.test` |
| | Accountant | Adnan Sheikh | `accounts@familycare.seed.test` |
| Noor Dental Studio | Owner — clinic **pending approval** | Dr. Saad Anwar | `owner@noordental.seed.test` |

Lab logins are printed at the end of the run (and listed below once the lab
step is final).

## What you get

- **Platform:** super admin; 3 approved clinics with a year's subscription
  payment each; 1 clinic waiting for approval (approval screen).
- **Clinics:** Smile Care has two branches (Clifton, Gulshan-e-Iqbal) —
  Dr. Bilal works at both on alternate days. Al-Shifa charges 5 % tax.
  Every feature is on except the ones without a provider (SMS, WhatsApp,
  online payments, online booking, patient portal); the general clinic has
  the dental-only features off.
- **Staff:** owners, admins, doctors (salary, salary + commission,
  commission only), receptionists, assistants / nurse, accountants, one
  attendant without a login; weekly schedules.
- **Patients:** consents, insurance, dental history, recalls, referrals,
  feedback, communications; minors with guardians.
- **History (last 60 days, busier in the last two weeks):** bookings,
  confirmations, cancellations, no-shows, walk-ins, queue tokens per doctor,
  consultations with notes, vitals, teeth charts, treatments, treatment
  plans with sessions over later visits, prescriptions (Urdu instructions).
- **Today:** some visits done, patients waiting / in consultation, bookings
  for later today; plus bookings for the next 14 days.
- **Billing, labs, inventory:** see the step files (`steps/03`, `04`, `05`,
  `07`, `08`).

## How it is built

```
run.ts                 entry: setup steps → visits (child process per clinic) → after-steps
check.ts               npm run seed:check (throw-away schema)
lib/seed-app.ts        boots the app's module graph without HTTP / jobs / relays
lib/time-travel.ts     moves the JS clock to the simulated day
lib/db-clock.ts        moves Postgres now() and DEFAULT timestamps the same way
lib/context.ts         SeedContext (clinics, staff, patients, visits) + helpers
data/*.ts              clinics & staff, patients, service catalog, clinical scenarios
steps/*.ts             one file per area, run in the order in steps/index.ts
```

**Time travel:** to build history the seed moves the clock to each day it
simulates, so every service stamps records with that day — the JS clock
(`Date`) and, for the seed's own DB connections only, Postgres `now()` and
`DEFAULT now()` columns (a temporary `seed_clock_<pid>` schema with a
`now()` override and per-table triggers that only act for the seed's own
sessions). The schema is dropped at the end; if a run is killed, drop any
leftover `seed_clock_*` schema with `CASCADE` (it holds no data and also
removes its triggers).

**Adding data:** put fixed data in `data/`, logic in a step, and create rows
through the module's service (look at how the controller calls it). Use
`ctx.rng` (deterministic) for choices and `travelTo()` for dates.
