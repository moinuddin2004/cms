# Conflicts and oddities — ch12-data-model-overview.md

## Doc vs code
- **CLAUDE.md** says `invoices` and `inventory` are entity-only stubs and lists `chairs`, `inventory`, `invoices` as entity-only. **Code:** billing v2 `invoices` and the inventory module are implemented; only `chairs` and the single `inventory` table are unregistered. Evidence: ENTITY_CATALOG §1, §10; `forFeature` registrations.
- **docs/appointments-and-queue.md** says there are no migrations. **Code:** three files in `backend/src/migrations/`. Evidence: folder listing; `docs/database-migrations.md`.

## Oddities
- Catalog notes for the 10 inventory tables are shifted one row (known defect); the `form_schema_versions` trigger note is false (known defect). Neither is repeated in the chapter.
- Primary-key column is named `uuid` on the four identity tables and `id` everywhere else.
- Older tables use `timestamp without time zone` for created/updated timestamps; newer use `timestamptz`.
- Most billing v2, queue and lab tables keep tenant columns without foreign keys; no comment explains the choice.
