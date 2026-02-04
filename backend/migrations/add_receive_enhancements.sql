-- Migration: Add enhanced sample receiving fields
-- Date: 2026-02-04
-- Description: Add fields for sample list upload, sample selection, additional notes, and reviewer verification

-- Add new columns to sample_receive_records table
ALTER TABLE sample_receive_records
ADD COLUMN IF NOT EXISTS sample_list_file_path VARCHAR,
ADD COLUMN IF NOT EXISTS selected_sample_ids TEXT,
ADD COLUMN IF NOT EXISTS additional_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Create index for reviewer lookup
CREATE INDEX IF NOT EXISTS idx_sample_receive_records_reviewed_by ON sample_receive_records(reviewed_by);

-- Comments for documentation
COMMENT ON COLUMN sample_receive_records.sample_list_file_path IS 'Path to the uploaded sample list file (Excel/CSV)';
COMMENT ON COLUMN sample_receive_records.selected_sample_ids IS 'JSON array of selected sample IDs for receiving';
COMMENT ON COLUMN sample_receive_records.additional_notes IS 'Additional notes or remarks for the receiving process';
COMMENT ON COLUMN sample_receive_records.reviewed_by IS 'User ID of the reviewer who verified the receiving';
COMMENT ON COLUMN sample_receive_records.reviewed_at IS 'Timestamp when the reviewer verification occurred';
