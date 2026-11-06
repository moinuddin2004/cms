-- Foreign keys that could not go inside CREATE TABLE because the two
-- tables point at each other (a circular reference): whichever table is
-- created first cannot reference the other yet, so the key is added here,
-- after every table exists.

-- (none)
