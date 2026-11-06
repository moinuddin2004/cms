-- !!! DESTROYS ALL DATA !!!  Dev / QA databases only — NEVER production.
-- Drops everything in the public schema (tables, types, functions, data)
-- and recreates it empty. Then run run_all.sql (or files 01–05 in order).

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO PUBLIC;
