-- 005_mrz_misread.sql
-- Dev-only marker: a version whose MRZ identity fields (passport number, date
-- of birth, expiry) came from the offline "misread specimen" — values that are
-- wrong but internally consistent (check digits pass). Lets the UI label them
-- "misread (dev)" instead of "verified".
ALTER TABLE data_versions
  ADD COLUMN IF NOT EXISTS mrz_misread TINYINT(1) NOT NULL DEFAULT 0;
