-- Audit-level qualitative note fields.
-- Replace the old per-section remark approach with two dedicated audit
-- columns that the supervisor fills once per audit (not per section).
-- Historical audits receive NULL — the API and UI treat NULL as "not filled".
ALTER TABLE `audits`
  ADD COLUMN `call_observation`    LONGTEXT NULL AFTER `overall_comment`,
  ADD COLUMN `area_of_improvement` LONGTEXT NULL AFTER `call_observation`;
