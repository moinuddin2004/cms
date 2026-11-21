# MedTrackr mobile app — kaun kya karta hai (report, 2026-11-21)

Code (`mobile/develop`) se check kar ke likhi gayi hai, sirf docs se nahi. Ek hi app mein **do alag
hisse (spaces)** hain — Welcome screen par user chunta hai:

- **Staff space** — clinic ka staff (doctor, reception, assistant, owner/admin, accountant). Login = email + password (Google optional).
- **Patient space** — mareez aur unke ghar wale. Login = email par 6-digit code (password nahi).

Dono ke login, data aur cache bilkul alag hain. Jo shakhs dono ho (jaise doctor jo khud bhi mareez hai)
woh More / Home se space badal sakta hai, sign-out kiye baghair.

> Staff mein **role ka naam code mein check nahi hota** — har screen ek *permission* maangti hai. Neeche
> "Doctor / Receptionist" se murad system ke default role templates hain
> (`backend/src/access/catalog/templates.ts`). Clinic owner `/admin/roles` (web) par kisi bhi role ki
> permissions badal sakta hai, to mobile par wohi badal jayega.

---

## 1. Staff space — screens (tabs)

| Tab / screen | Kya kar sakte hain | Kaunsi permission chahiye |
| --- | --- | --- |
| **Today** | Aaj ka khulasa: booked / waiting / avg wait tiles; aaj ki collection + unpaid invoices; "Doctors now" (kaun doctor kis ko dekh raha hai, kitne wait mein — tap = us doctor ki line); agli appointments. Pull to refresh. | Har block alag: `appointments.view`, `billing.invoice.view`, `queue.board.view` |
| **Queue → My queue** (doctor view) | Session start, **Call next**, kisi khaas mareez ko bulana, **Start consultation**, **Done**, Recall, Undo call, Skip, **Send for test**, Abort, session pause/resume, smart order on/off, **Close session** (bache mareez cancel ya doosre doctor ko transfer). Live updates (connection pill). | `queue.doctor.own` (smart order: `queue.entry.reprioritize`) |
| **Queue → Board** (reception view) | Har doctor ki line: abhi / waiting / on hold / skipped. Har row par: Mark urgent (wajah ke saath), Transfer to doctor, Skip, Rejoin, Cancel visit, Back from test, Patient file, Ticket dikhana. | `queue.board.view`; actions: `queue.entry.manage`, `queue.entry.reprioritize`, `queue.checkin` |
| **Walk-in** | Doctor chuno → purana mareez dhoondo ya naya (naam + phone) → wajah, urgent toggle. Agar mareez pehle se kisi aur doctor ki line mein ho to warning. | `queue.checkin` |
| **Arrivals (check-in)** | Aaj ki appointments jo abhi check-in nahi hui → Check in. Bohat late ho to "walk-in bana do" option. | `queue.checkin` + `appointments.view` |
| **Patients** | Naam / phone / MR no. se search, recent mareez, "+" se quick register (duplicate phone check). Patient file: Call, WhatsApp, MR copy, allergy/alert strip, Overview / Visits / Rx / Chart (chart sirf dekhne ke liye). | `patients.view`; register: `patients.create`; Visits/Rx/Chart: `patients.clinical.view` |
| **Link app (QR)** | Mareez ke liye QR banana (15 min countdown), WhatsApp par link bhejna, link status, revoke. | `patients.app_link.manage` |
| **Schedule** | Din ki strip, doctor / status filter, ghante ke hisaab se appointments; tap = detail sheet + Check in. Doctor ko sirf apni dikhti hain. | `appointments.view` (check-in: `queue.checkin`) |
| **Notifications** | Bell, saare clinics ka inbox, mark all read, tap = sahi screen (zaroorat ho to clinic badalne ka poochta hai). Push notifications + sound on/off. | Har signed-in staff |
| **More** | Profile card (clinic + location), Switch location, Notification sound, **Appearance (Light / Dark / System — naya)**, Patient space par jana, App version, Sign out. | Har signed-in staff |

**Offline:** saved data offline dikhta hai; tabdeeli (mutation) offline band hai. Har queue action
"retry-safe" hai (idempotency key), to double-tap se double entry nahi banti.

## 2. Doctor kya karta hai

**Mobile par dikhta hai:** Queue (sirf *My queue*, Board nahi) · Today (stats + agli appointments; paisa nahi) ·
Patients (sirf apne mareez, Visits / Rx / Chart ke saath) · Schedule (sirf apni appointments) · More.
App khulte hi **Queue** par jata hai.

**Doctor ka roz ka kaam (daily):**
1. Subah session start.
2. **Call next** → mareez aata hai → **Start consultation** → **Done**.
3. Zaroorat ho to **Send for test** (mareez test ke baad wapas line mein aata hai), Skip, Recall.
4. Kisi mareez ki file / pichli visits / nuskhe dekhna.
5. Din ke aakhir mein **Close session** (bache hue mareez cancel ya transfer).
6. Notifications (naya mareez aya, test se wapas aya, waghaira).

**Doctor mobile par NAHI kar sakta (sirf web par):** nuskha (prescription) likhna, consultation notes,
teeth chart edit, vitals likhna, photo/document upload, lab results, billing, appointment book/reschedule.
Mobile par patient file sirf **dekhne** ke liye hai.

## 3. Reception / front desk kya karta hai

**Dikhta hai:** Today (stats, aaj ki collection, doctors now, agli appointments) · Queue (sirf **Board**) ·
Patients (register kar sakta hai; clinical tabs — Rx/Chart/Visits detail — nahi) · Schedule (check-in ke saath) · More.

**Reception ka roz ka kaam (daily):**
1. Aane wale mareez ko **Arrivals** se check-in, ya **Walk-in** banana.
2. Board par lines sambhalna: skip, rejoin, doosre doctor ko transfer, cancel, test se wapsi.
3. Mareez search / naya register.
4. Schedule dekhna, appointment se check-in.
5. Mareez ko ticket dikhana; app link ka QR dena (agar permission ho — neeche dekhein).

**Dhyaan dein (owner ka faisla chahiye):**
- Default **Receptionist** role mein `patients.app_link.manage` **nahi** hai → stock receptionist mobile se
  mareez ko app link (QR) nahi de sakta. Agar reception ko yeh kaam dena hai to `/admin/roles` mein
  permission on karein.
- Receptionist **Mark urgent** bhi nahi kar sakta (`queue.entry.reprioritize` template mein nahi).

## 4. Owner / Admin, Assistant, Accountant

| Role | Mobile par kya |
| --- | --- |
| **Owner / Admin** | Sab kuch jo doctor + reception dono karte hain: Queue mein *My queue* aur *Board* dono (switch), poora Today (collection samet), urgent/transfer, link app QR, location switch. **Roz:** subah Today par clinic ka haal (paisa, wait, kaun doctor free), notifications, zaroorat par board chalana. |
| **Assistant** | Board, check-in, Today stats, schedule, patient file mein clinical view. Line manage (skip/cancel) nahi. |
| **Accountant** | Sirf Today (collection / unpaid tiles) aur More. Billing / payment / report screens mobile par nahi hain. |

Agar kisi role ko mobile ki koi permission na ho to More par likha aata hai: "No mobile features for your role".

## 5. Patient space — mareez kya karta hai

| Screen | Kya hai |
| --- | --- |
| **Sign in** | Email → 6-digit code → (naya account ho to) naam. Google sign-in backend mein tayyar hai magar app mein abhi chhupa hai. |
| **Clinic se link (claim)** | Clinic ka QR / link scan → clinic aur record ka (chhupa hua) naam dikhta hai → "Main / Mera bacha / Mere walid ya walida / Koi aur" chuno → consent → record link ho jata hai. |
| **Home (naya)** | Salaam card, shortcuts (Today, Records, Family, Reminders), linked clinics, **Appearance (Light/Dark/System)**, **Language (English/اردو)**, Account (staff space, sign out, account delete). |
| **Today** | Aaj ka **live token** card, dawai ki doses waqt ke hisaab se (**Taken / Skip**), aaj ki appointment **Confirm**, aane wali cheezein, family profile filter, "reminders on karein" prompt. Offline bhi chalta hai; dose Taken/Skip offline save ho kar baad mein sync. |
| **Live token / visit** | Token number, aap se aage kitne log, abhi kaun ja raha hai, live update; "aapki baari" state; baari qareeb ho to push notification. |
| **Records** | Appointments / Visits / Prescriptions / Bills (Bills sirf agar clinic dikhaye). Nuskhe ki detail (dawai, Urdu naam/hidayat), appointment detail + Confirm, clinic ko call. |
| **Family** | Profiles (khud + ghar wale), apni detail edit, har profile ke linked clinics. Ghar wale clinic ke QR se hi judte hain. |
| **Linked clinics** | List, unlink (clinic ka record clinic ke paas rehta hai), link history. |
| **Medicine reminders** | Nuskhe se phone par khud-ba-khud alarm, private reminders (notification mein dawai ka naam chhupa), battery-optimisation guide. Internet ke baghair bhi bajte hain. |
| **Contact** | Clinic ko call / WhatsApp, emergency numbers. |
| **Account delete** | Type kar ke confirm; phone ka data saaf; clinic ka record clinic ke paas. |

**Mareez ka roz ka kaam (daily):** Today kholna → dawai ki dose "Taken" karna → appointment confirm
karna → clinic jaye to live token dekhna → visit ke baad Records mein nuskha dekhna. Reminders khud bajte hain.

**Urdu:** poora patient space Urdu (Nastaliq font) mein; staff space sirf English.

## 6. Abhi kya baqi hai / kya nahi hai

- **Device par test nahi hua** (M0-D) — kisi asli phone par poora run baqi hai. Store screenshots, final app id (O-01) aur legal review bhi baqi.
- Patient: Google sign-in app mein chhupa hai; Apple sign-in (iOS) nahi bana; patient appointment *request / reschedule* nahi kar sakta (sirf confirm).
- Staff: prescription likhna, appointment booking, payment collection, vitals, photo upload, lab status, reports — sab sirf web par.
- Backend: `POST /auth/devices/unregister` (staff sign-out ke baad push token hatana) abhi nahi bana.
- UI-02 ke baqi chhote kaam: patient offline banner Urdu mein, Walk-in header, DoseRow/Reminders padding, app ka "Today-first" start.
