# Chapter 66 — Risks

This chapter lists the risks an owner carries by running the Platform as it is today: risks in the data model, risks in how it is operated, observations that a regulator or a careful customer might ask about, and security risks described at category level only. It is for the product owner, who decides what to fix before more clinics rely on the Platform. Nothing in this chapter was tested by running the application; every item comes from reading the code and the generated data-model catalog.

## 66.1 How to read the risks

Each risk has a likelihood in normal use (Likely, Possible, Unlikely) and an impact on a live clinic (High, Medium, Low). Security items are grouped by category and deliberately contain no file paths, endpoint paths, secret values or exploit detail, because this text is shared outside the engineering team. The engineering team holds the detailed findings separately.

## 66.2 Data-model risks

| Risk | What can happen | Likelihood | Impact | Evidence |
|---|---|---|---|---|
| Count-plus-one and last-plus-one numbering | After a permanent delete, or when two people save at the same moment, a patient, plan, employee or purchase order number can repeat and the save fails. | Likely for patients after any delete | High | Chapters 28, 62 |
| Platform-wide unique keys with per-organization numbering | Prescription and purchase order numbers restart for each organization but are unique across all of them, so a second clinic collides with the first. | Likely in a multi-clinic deployment | High | Chapters 19, 32, 39, 62 |
| Login id stored in employee-id columns | Some writes put a user id where an employee id is expected. Without a foreign key the value is silently wrong; with one the write may fail. | Possible | Medium | Chapters 28, 32, 39 |
| Tenant columns without foreign keys | Most billing, queue and lab tables keep organization and location ids with no foreign key, so the database cannot reject a wrong tenant id. | Unlikely | Medium | Chapters 12, 27 |
| "Append-only" promised by comments only | Only the commission ledger, the audit log and the status history are protected by triggers. The billing audit log, the queue log, the ledgers and the allocation table rely on application code. | Unlikely | Medium | Chapters 26, 27 |
| Duplicate concepts | Two prescription tables, two audit mechanisms, two number-sequence mechanisms, two outbox tables and two feature-switch mechanisms coexist. A change to one can miss the other. | Possible | Medium | Chapter 27 |
| Deletes blocked by RESTRICT keys | Deleting a patient or employee with history fails with a generic error. | Likely | Low | Chapters 16, 17 |
| Schema drift between development and production | Development builds the schema from the entities; production applies a reviewed diff. Two migrations were written before later entity changes, so production needs the diff applied. | Possible | Medium | Chapters 6, 12 |
| Mixed timestamp types | Older tables use timestamps without a time zone, newer ones with. | Unlikely | Low | Chapter 12 |

The two numbering rows are the most urgent because they fail in ordinary use. The rest are latent: they cost nothing until a clinic hits a particular edge.

## 66.3 Operational risks

| Risk | What can happen | Likelihood | Impact | Evidence |
|---|---|---|---|---|
| Exactly one worker process | The worker runs the outbox relay, the notification relay and all eight scheduled jobs. Two workers would duplicate jobs; none would stop live queue updates, notifications and nightly checks. There is no supervision described. | Possible | High | Chapters 6, 63 |
| In-memory rate limiting | Login and other limits are counted in one API process. With several instances the limit multiplies, and a restart clears it. | Likely when scaled out | Medium | Chapters 6, 56 |
| Server time zone for jobs | No schedule sets a time zone, so jobs follow the server clock, not each location. | Likely | Medium | Chapters 6, 62, 63 |
| No deploy or CI configuration | There is no pipeline, container file or hosting description in the repository. Builds and releases depend on individual knowledge. The built output path also differs from the one in the start script. | Likely | High | Chapter 6 |
| Dependence on Redis | Realtime updates, access-change propagation and settings caches use Redis. Without it clinics see stale screens for up to the fallback interval. | Possible | Medium | Chapters 54, 63 |
| Per-process caches | The subscription decision (30 seconds), access context (5 minutes), version (15 seconds) and queue policy (60 seconds) are cached per process. | Likely | Low | Chapters 30, 45, 57 |
| Nightly jobs only log | The money invariant check and the inventory alert job write to the log. Nobody is told unless someone reads it. | Likely | Medium | Chapters 34, 39 |
| Calendar licence | The appointment calendar uses premium resource views from a third-party library, and the licence key in use is a non-commercial one. | Likely | Medium | Chapter 29 |
| Seeded data re-created at boot | Seeds run in the worker as well as the API and recreate a deleted system role, and re-seed starter plan templates when a clinic has none. | Possible | Low | Chapters 11, 33 |
| Unrun test coverage of behaviour | The handbook was written by reading code. The access and billing suites exist, but the findings here were not reproduced. | Possible | Medium | Chapter 64 |

Of these, the single worker and the missing deploy configuration matter most, because a failure there is silent and affects every clinic at once.

## 66.4 Compliance-sounding observations

These are observations, not legal conclusions. A clinic or a regulator may ask about them; the Platform makes no compliance claim, and earlier screenshots that showed such claims were excluded from the handbook.

- **No retention policy.** Nothing purges or archives old sessions, security logs, audit rows, notification messages or consent signatures. Network addresses and browser strings are kept indefinitely.
- **Audit coverage is partial.** Patient records, billing, prescriptions and queue events keep history. Appointments, employees, payroll, organizations and locations do not, and there is no organization-wide viewer.
- **No row-level security.** Tenant isolation is application-level only. The queue sets database session values for tenant and location, but no database policy uses them.
- **Patient documents on external storage.** Documents, insurance images and prescription PDFs are stored with an external provider and referenced by address. Access to those addresses is not decided by the Platform's permissions.
- **Consent signatures inside the database.** Signature images are stored inline in the consent row, and immutability of consents is a convention, not a database rule.
- **Message text in logs.** The stand-in delivery provider writes message bodies and recipient addresses to the application log, which would be unsuitable once real patient channels are switched on. Outbox rows also keep rendered text.
- **No second factor or lockout.** Accounts rely on a password with a short minimum.

## 66.5 Security risks by category

These categories summarise findings from all chapters. They contain no locations, paths or exploit detail by design.

| Category | Summary | Impact | Chapters |
|---|---|---|---|
| Tenant isolation checks missing on some endpoints | A few reads or writes do not filter by organization or location, or do not verify that referenced records belong to the caller's organization or patient scope. A few reads apply organization scope where the permission has a narrower scope. | High | 19, 30, 32, 33, 34, 42 |
| Application-level isolation only | No database row-level policies back up the application checks, so one missed check is a data leak. | Medium | 8, 30, 57 |
| Committed credentials in test scripts | Test scripts and a fixture in the repository hold a database connection and test passwords. They need rotation and removal from history. | High | Inventory of documents |
| Token handling and logging | A legacy realtime gateway logs token-related data and accepts any origin. Real-time connections check the token once and outlive its expiry. A revoked session's access token stays valid until it expires. | High | 56, 57, 63 |
| Input from clients trusted | The server fetches a signature image address supplied by the client. An upload route is open to any organization member. Upload size and type are only partly restricted. Some edit screens send whole rows. | Medium | 28, 32, 58 |
| Information exposure in errors | The error envelope carries raw internal messages for unexpected errors. | Medium | 5, 61 |
| Public routes by design | The waiting-room display and lab magic links need no login by design, using an identifier or a bearer token as the credential. They rely on expiry, revocation and throttling, and the throttle is in memory. | Medium | 30, 40, 41 |
| Secret reuse | The signing secret for magic links falls back to the access-token secret when its own is missing. | Medium | 40, 41 |
| Authentication hardening | Short minimum password, two different minimums on two paths, no lockout, no second factor, no logging of wrong passwords, no rate limit on two sensitive endpoints. | Medium | 56, 45, 47 |
| Authorization granularity | Some actions need only a broad read permission, and one payroll permission guards all payroll data. | Medium | 37, 38, 40 |
| Audit and retention | Missing audit for personnel and payroll data; no retention. | Medium | 13, 60 |
| Money-moving replay protection | Idempotency keys are required for most money actions but optional for one vendor payment path. | Low | 42 |
| Third-party licence | See the calendar licence in Section 66.3. | Medium | 29 |

The high-impact rows are tenant-isolation gaps, committed credentials and token handling. The others are hardening work that lowers the chance and the blast radius of a mistake.

## 66.6 What to fix first

Fix the committed credentials first: rotate them and remove the files from history, because the exposure already exists. Then close the tenant-isolation gaps and the token logging, since a single missing filter lets one clinic read another's data. Third, fix the two numbering collisions, which break daily work. Fourth, document and automate deployment and decide how the single worker is supervised. After these, add audit coverage for staff and payroll and a retention policy, then harden authentication and the realtime token check. The rest can follow the roadmap.
