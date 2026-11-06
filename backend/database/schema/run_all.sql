-- psql only: runs every schema file in order on an EMPTY database.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f schema/run_all.sql
-- In a GUI tool (DataGrip, pgAdmin) open and run the files 01 → 05 instead.

\ir 01_extensions_functions.sql
\ir 02_tables.sql
\ir 03_foreign_keys_circular.sql
\ir 04_search_indexes.sql
\ir 05_triggers.sql
