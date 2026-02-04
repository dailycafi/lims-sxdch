-- Migration: Add backup subject fields to test_groups table
-- Date: 2026-02-03
-- Description: Add backup_subject_prefix and backup_subject_start_number columns for backup personnel numbering rules

ALTER TABLE test_groups ADD COLUMN IF NOT EXISTS backup_subject_prefix VARCHAR;
ALTER TABLE test_groups ADD COLUMN IF NOT EXISTS backup_subject_start_number INTEGER DEFAULT 1;

-- Ensure existing rows have the default value
UPDATE test_groups SET backup_subject_start_number = 1 WHERE backup_subject_start_number IS NULL;
