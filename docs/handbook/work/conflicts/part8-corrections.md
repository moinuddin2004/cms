# Part 8 corrections to other chapters

| Chapter | Claim | Code reality | Evidence |
|---|---|---|---|
| Chapter 59 (Notification mechanics), opening paragraph | "20 are seeded" notification events | 21 events are seeded; Chapters 24 and 44 say 21 | `backend/src/notifications/seeds/notification-events.seed.ts` (21 event codes) |
| Chapter 40 (Dental lab), effects of the clarification feature | Refers to section 40.3.31 | Chapter 40 headings end at 40.3.30 | Chapter 40 text; noted by Chapter 49 |
| Chapter 56 versus Chapter 45 | Chapter 56 labels email verification Implemented; Chapter 45 labels it Partial | Same code; nothing is gated by verification. Chapter 64 keeps each chapter's own label and notes the difference | Both chapters |
| Chapter 2 (Roles), Doctor row | Doctor sidebar includes Clinic overview with no caveat | Chapter 36: the Doctor template holds own scope and the API refuses it | Chapter 36 |
| Chapters 19, 32, 62 | Cross-organization prescription number collision "not tested" | Confirmed by reading code: the number restarts per organization at 1 per year and the column is unique across the Platform, so a second organization's first prescription collides | `prescriptions/services/prescription.service.ts` generator; `prescription.entity.ts` unique index |
| Chapters 28, 62 | Patient-number collision after delete described as possible | Confirmed by reading code: the count includes only existing rows (patients are hard-deleted), the number has a per-organization unique index, so every registration after a delete repeats the same number | `patients/patients.service.ts` generatePatientNumber; `patient.entity.ts` unique index |

