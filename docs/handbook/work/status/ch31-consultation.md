| Chapter | Feature | Status | One-line note |
|---|---|---|---|
| 31 | Start a consultation (encounter created) | [Implemented] | ensureForQueueEntry inside the start-consultation transaction; idempotent per queue entry |
| 31 | Re-open a running consultation | [Implemented] | GET /encounters/by-queue-entry/:id; conduct scope own = session doctor |
| 31 | See the patient at a glance | [Implemented] | Vitals, 4 previous visits, 3 signed prescriptions with reuse |
| 31 | Allergy and medical alerts | [Partial] | Client-side chips from free-text allergies/medical history and latest vitals flags; no structured allergy list or drug check |
| 31 | Write the visit notes (auto-saved) | [Implemented] | PATCH /encounters/:id, 800 ms debounce, 4000-char fields; not locked after completion |
| 31 | Record the treatments done today | [Implemented] | POST /encounters/:id/treatments; catalog procedure or typed name; no edit/delete |
| 31 | Patient record slide-over | [Implemented] | Reuses patient tabs; amounts hidden |
| 31 | Prescription inside the consultation | [Implemented] | Draft on first complete line, autosave 1 s, Sign & print; panel not gated by permission/feature |
| 31 | Order lab work from the consultation | [Not implemented] | No lab entry point; lab orders have no encounter link |
| 31 | Complete the visit | [Implemented] | Flush saves, PATCH complete; appointment completed; charges in same transaction |
| 31 | Automatic charges on completion | [Implemented] | ChargeSourcesService.syncForEncounter; only when billing.invoices enabled; needsPricing fallback |
| 31 | Void charge of a removed treatment | [Partial] | handleRemoved exists but unreachable: no treatment delete, sync runs once at completion |
| 31 | Keep prices away from doctors | [Implemented] | HideTreatmentPricesInterceptor plus VisibleIf on patients.price.view |
| 31 | Encounter and treatment records outside the consultation | [Implemented] | GET /encounters/:id, GET/POST /treatments with patient scope |
| 31 | SOAP notes and note templates | [Not implemented] | Only encounter text fields; phrase chips fixed in code |
