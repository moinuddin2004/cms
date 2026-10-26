# Glossary — ch12-data-model-overview.md

- **Entity catalog** — The generated field-level reference of every table, column, key and constraint (`backend/docs/data-model/ENTITY_CATALOG.md`).
- **Owning module** — The backend module folder whose `entities/` directory defines a table's entity class.
- **synchronize** — The ORM setting that builds and updates the schema from the entities on API start-up; on in development, off in production.
- **schema:sync:prod** — The reviewed production command that applies entity changes to the production schema.
- **Legacy baseline** — The migration `1776356529788-create-table`, recorded as applied but never executed.
- **Append-only trigger** — A database trigger that blocks UPDATE and DELETE on a table (`commission_entries`, `audit_logs`, `status_history`).
- **uuid v7** — A time-ordered uuid produced by `uuid_generate_v7()`; primary-key default of the newer tables.
- **Paisa** — Integer minor unit of the rupee (100 paisa = 1 rupee); columns ending in `_paisa`.
- **Logical reference** — A column that holds another row's id without a foreign key; the database does not check it.
- **Polymorphic reference** — A type + id column pair (for example `entity_type` + `entity_id`) that can point to rows of different tables; no foreign key is possible.
- **Actor column** — A column such as `created_by` or `approved_by` that records which user did something; holds a user id without a foreign key.
- **Tenant column** — `organization_id` or `location_id` on a row that belongs to one organization or location.
- **Scope class** — The catalog's classification of a table by its tenant columns (global, organization, organization + location, and so on).
- **Domain** — A group of related tables drawn as one box in the overview diagram.
