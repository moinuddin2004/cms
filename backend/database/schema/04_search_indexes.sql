-- Ctrl+K quick search: trigram (pg_trgm) GIN indexes on patients.
-- These are on EXPRESSIONS, so they can't be declared in the entity. The
-- search SQL in src/search/search.service.ts uses exactly these expressions —
-- change both together.

CREATE INDEX idx_patients_name_trgm
  ON patients USING gin (lower(full_name) gin_trgm_ops);

CREATE INDEX idx_patients_number_trgm
  ON patients USING gin (lower(patient_number) gin_trgm_ops);

CREATE INDEX idx_patients_phone_digits_trgm
  ON patients USING gin (regexp_replace(phone, '\D', '', 'g') gin_trgm_ops);

CREATE INDEX idx_patients_guardian_phone_digits_trgm
  ON patients USING gin (regexp_replace(coalesce(guardian_phone, ''), '\D', '', 'g') gin_trgm_ops);

CREATE INDEX idx_patients_cnic_digits_trgm
  ON patients USING gin (regexp_replace(coalesce(cnic, ''), '\D', '', 'g') gin_trgm_ops);
