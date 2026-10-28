# Conflicts — ch27-overlaps-and-ambiguities

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| ENTITY_CATALOG §10 | `patient_visits` is "a per-location visit summary (INFERRED)" | Nothing writes it; `PatientsService.getVisits` only reads (`visitRepo.find`) | `patients/patients.service.ts:1109`; no save/insert of `PatientVisit` |
| `prescription.entity.ts` comment | Legacy table kept while consumers migrate | Web Clinical tab still reads and creates legacy rows ("Legacy quick-Rx history", `PrescriptionFormDialog`) | `web-app/src/features/patients/components/tabs/ClinicalTab.tsx` |
| ENTITY_CATALOG §10 append-only list | Lists ledger_entries, ledger_journals, billing_audit_logs, notification_outbox | `payment_allocations` and `ledger_journal_lines` are also documented append-only without triggers | entity comments |

## Oddities
- Inventory PO numbering defect (see ch23 conflicts) also affects the "sequence mechanisms" topic.
