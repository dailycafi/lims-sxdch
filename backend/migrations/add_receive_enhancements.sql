-- Migration: Add sample receiving enhancements
-- Description: Add fields for sample list upload, sample selection, additional notes, and reviewer verification
-- Date: 2026-02-03

-- Add new columns to sample_receive_records table
ALTER TABLE sample_receive_records
ADD COLUMN IF NOT EXISTS sample_list_file_path VARCHAR,
ADD COLUMN IF NOT EXISTS selected_sample_ids TEXT,
ADD COLUMN IF NOT EXISTS additional_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Create index for reviewer lookups
CREATE INDEX IF NOT EXISTS idx_sample_receive_records_reviewed_by ON sample_receive_records(reviewed_by);
