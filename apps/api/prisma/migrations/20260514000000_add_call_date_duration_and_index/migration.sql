-- Phase 1 stability migration.
--
-- 1) Add `call_date` (DateTime) and `call_duration` (Int seconds) to the
--    audits table. Both nullable so historical rows continue to load.
-- 2) Drop the legacy application-only uniqueness assumption on
--    `call_reference` by adding a non-unique index that callers can use
--    for fast filtering.  The DB-level uniqueness was never enforced in
--    a constraint, but old code blocked duplicates via a runtime check;
--    that check is being removed in the service so duplicates are now
--    explicitly allowed.  An index keeps lookups fast.
--
-- All operations are additive and safe for live production data — no
-- existing rows are touched.

ALTER TABLE `audits`
  ADD COLUMN `call_date`     DATETIME(3) NULL AFTER `call_reference`,
  ADD COLUMN `call_duration` INT         NULL AFTER `call_date`;

-- `call_reference` was already non-unique at the DB layer. Add an
-- explicit index now that it's the supervisor's primary lookup key
-- and we expect duplicate values.
CREATE INDEX `audits_call_reference_idx` ON `audits` (`call_reference`);
CREATE INDEX `audits_call_date_idx`      ON `audits` (`call_date`);
