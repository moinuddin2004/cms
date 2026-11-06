-- Extensions and functions the tables need. Run FIRST.
-- Works on any PostgreSQL 13+ (gen_random_uuid() is built in from 13).
-- btree_gist and pg_trgm ship with PostgreSQL ("contrib"); on a managed host
-- they only need to be allowed for your database user.

-- appointments.no_doctor_overlap: uuid "=" inside a GiST exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Ctrl+K quick search: trigram indexes on patients (04_search_indexes.sql).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- uuid_generate_v7(): time-ordered UUIDs (RFC 9562), the primary-key default
-- of the newer tables (lab, audit, …). Built from gen_random_uuid(): the first
-- 48 bits become the unix-ms timestamp and the version nibble becomes 7.
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
                FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid
$$;

-- Used by the append-only triggers in 05_triggers.sql: history tables only
-- ever get new rows; UPDATE and DELETE are refused by the database itself.
CREATE OR REPLACE FUNCTION reject_append_only_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;

-- commission_entries: append-only, except settlement_id, which may be set
-- once, and released back to NULL only while its settlement is still PENDING.
CREATE OR REPLACE FUNCTION commission_entries_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_entries is append-only: delete refused';
  END IF;
  IF OLD.settlement_id IS NOT NULL
     AND NEW.settlement_id IS DISTINCT FROM OLD.settlement_id THEN
    IF NEW.settlement_id IS NOT NULL OR EXISTS (
         SELECT 1 FROM commission_settlements s
          WHERE s.id = OLD.settlement_id AND s.status <> 'PENDING') THEN
      RAISE EXCEPTION 'commission entry % is already settled', OLD.id;
    END IF;
  END IF;
  IF (NEW.id, NEW.organization_id, NEW.location_id, NEW.assignment_id,
      NEW.charge_id, NEW.source_type, NEW.source_id, NEW.base_minor,
      NEW.rate_bps, NEW.amount_minor, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.organization_id, OLD.location_id, OLD.assignment_id,
      OLD.charge_id, OLD.source_type, OLD.source_id, OLD.base_minor,
      OLD.rate_bps, OLD.amount_minor, OLD.created_at) THEN
    RAISE EXCEPTION 'commission_entries is append-only: only settlement_id may change';
  END IF;
  RETURN NEW;
END
$$;
