# Conflicts — ch26-workflow-engine-and-common

| Doc | Claim | Code reality | Evidence |
|---|---|---|---|
| `form-schema-version.entity.ts` comment, ENTITY_CATALOG | A trigger rejects edits/deletes of published versions | No trigger exists; only `commission_entries`, `audit_logs`, `status_history` have triggers. Immutability is service-enforced (`FormSchemasService`, draft-only edits) | grep `CREATE TRIGGER` in `backend/src`; `engine/forms/form-schemas.service.ts:637` |
| ENTITY_CATALOG §2.2 | Migration `lab-management-foundation` creates `audit_logs`/`status_history` | Migration lacks `subject_id` column and index present in entities; prod sync must add them | ENTITY_CATALOG §2.2 |
| CLAUDE.md | `chairs` entity-only | Confirmed | `chairs/entities/chair.entity.ts`, no module |
