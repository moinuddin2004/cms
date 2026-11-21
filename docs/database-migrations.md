# Database schema

Replaced on 2026-11-06. The schema is no longer managed by TypeORM
(`synchronize` and TypeORM migrations were removed). It is hand-maintained
SQL in `backend/database/`: `schema/` builds an empty database and `changes/`
holds dated scripts for existing ones — see
[`backend/database/README.md`](../backend/database/README.md).
