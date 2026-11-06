-- Profile photo upload: storage key of the uploaded photo, so the old file
-- can be deleted when the user changes or removes it.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key varchar(500);
COMMIT;
