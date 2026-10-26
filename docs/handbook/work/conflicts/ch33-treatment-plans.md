# Conflicts and oddities — ch33-treatment-plans.md

## Doc vs code

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| Template page dialog text and `PlanTemplate` entity comment | "The procedures are copied into a patient's plan when a doctor uses this template" | No endpoint or screen creates a patient plan from a template; `CreateTreatmentPlanDto` has no items | `plan-templates/*`, `patients/dto/request/sub-entity.dto.ts`, `PlanTemplatesPage.tsx` |
| Template page subtitle | "Doctors pick one when starting a plan for a patient" | Templates are only picked in the Record Treatment dialog, whose button needs `patients.price.view` (the Doctor template lacks it) | `TreatmentsTab.tsx`, `EncounterDetailDialog.tsx`, `access/catalog/templates.ts` |
| Delete dialog | "Plans already made from it are not affected" | No plans are made from templates; tagged treatments lose `plan_template_id` (ON DELETE SET NULL) | `treatments/entities/treatment.entity.ts` |
| OUTLINE.md | "Plan billing summary" listed as a feature | Endpoint, API function and `usePlanBillingSummary` hook exist; no component uses the hook, so [Partial] | `features/billing/hooks/use-billing-queries.ts` |
| INVENTORY.md §4 | "patient treatment plans" listed as a screen area | No screen for patient plans; `useTreatmentPlans`, `useCreateTreatmentPlan` and related hooks are unused | `features/patients/hooks/usePatientSubEntities.ts` |

## Oddities

- `findAll` re-seeds the 12 defaults whenever the organization has zero template rows (also after the clinic deletes all of them).
- Plan template writes are not audited; patient plan writes are.
- `fromTreatmentPlan` ignores plan and item status and does not consult the service price list (passes a null price); items without an estimate become zero-priced charges with `needsPricing`.
- `planSummary` filters charges by the active location; plan items charged at another location are excluded.
- Plan numbers (TP-) are count-based and can collide after a patient with plans is hard-deleted.
- No transition maps for plan or item status; `actual_end_date` is never set automatically; `patientAcceptedAt` stays when acceptance is turned off again.
- Plan cost columns are decimal currency units; the summary converts to paisa for arithmetic.
- `plan_templates.organization_id` has no foreign key.

## Security

- Category: authorization breadth. The charges-from-plan and plan billing-summary endpoints check billing permissions only, not the patient's `patients.view` scope.
