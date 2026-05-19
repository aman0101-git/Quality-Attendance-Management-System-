CREATE DATABASE qams;
use qams;
SELECT * FROM user;
SELECT * FROM audit_answers;
SELECT * FROM audit_questions;
SELECT * FROM audit_sections;
SELECT * FROM audits;
SELECT * FROM projects;
SELECT * FROM scorecard_questions;
SELECT * FROM scorecard_sections;
SELECT * FROM scorecard_templates;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE audit_sections;
TRUNCATE TABLE audit_questions;
TRUNCATE TABLE audit_answers;
TRUNCATE TABLE audits;
TRUNCATE projects;
SET FOREIGN_KEY_CHECKS = 1;
