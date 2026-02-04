-- Special Sample Tables Migration
-- This migration creates tables for special sample management

-- Special sample type enum
DO $$ BEGIN
    CREATE TYPE special_sample_type AS ENUM ('SC', 'QC', 'BLANK', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Special sample status enum
DO $$ BEGIN
    CREATE TYPE special_sample_status AS ENUM (
        'pending', 'approved', 'rejected', 'received',
        'in_storage', 'checked_out', 'transferred', 'destroyed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Special sample applications table
CREATE TABLE IF NOT EXISTS special_sample_applications (
    id SERIAL PRIMARY KEY,
    application_code VARCHAR(50) UNIQUE NOT NULL,

    -- Project code configuration
    project_code_prefix VARCHAR(20) NOT NULL,
    project_code_separator VARCHAR(5) DEFAULT '-',
    project_code_suffix VARCHAR(20),

    -- Sample info
    sample_type special_sample_type NOT NULL,
    sample_name VARCHAR(200) NOT NULL,
    sample_source VARCHAR(200),
    sample_count INTEGER NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'tube',

    -- Storage requirements
    storage_temperature VARCHAR(50),
    storage_conditions TEXT,

    -- Purpose and notes
    purpose TEXT,
    notes TEXT,

    -- Status
    status special_sample_status DEFAULT 'pending',

    -- Approval workflow
    requested_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_special_sample_applications_status ON special_sample_applications(status);
CREATE INDEX IF NOT EXISTS idx_special_sample_applications_sample_type ON special_sample_applications(sample_type);
CREATE INDEX IF NOT EXISTS idx_special_sample_applications_requested_by ON special_sample_applications(requested_by);

-- Special samples table
CREATE TABLE IF NOT EXISTS special_samples (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES special_sample_applications(id),

    -- Sample codes
    sample_code VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,

    -- Sample info
    sample_type special_sample_type NOT NULL,
    sample_name VARCHAR(200) NOT NULL,
    sequence_number INTEGER NOT NULL,

    -- Status
    status special_sample_status DEFAULT 'pending',

    -- Storage location
    freezer_id VARCHAR(50),
    shelf_level VARCHAR(20),
    rack_position VARCHAR(20),
    box_code VARCHAR(50),
    box_id INTEGER REFERENCES storage_boxes(id),
    position_in_box VARCHAR(10),

    -- Receipt info
    received_by INTEGER REFERENCES users(id),
    received_at TIMESTAMP WITH TIME ZONE,

    -- Label printing
    label_printed BOOLEAN DEFAULT FALSE,
    label_printed_at TIMESTAMP WITH TIME ZONE,
    label_printed_by INTEGER REFERENCES users(id),
    print_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_special_samples_application_id ON special_samples(application_id);
CREATE INDEX IF NOT EXISTS idx_special_samples_sample_code ON special_samples(sample_code);
CREATE INDEX IF NOT EXISTS idx_special_samples_barcode ON special_samples(barcode);
CREATE INDEX IF NOT EXISTS idx_special_samples_status ON special_samples(status);
CREATE INDEX IF NOT EXISTS idx_special_samples_sample_type ON special_samples(sample_type);

-- Special sample configurations table
CREATE TABLE IF NOT EXISTS special_sample_configs (
    id SERIAL PRIMARY KEY,
    sample_type special_sample_type UNIQUE NOT NULL,

    -- Code format
    prefix VARCHAR(20) NOT NULL,
    default_separator VARCHAR(5) DEFAULT '-',
    allow_custom_separator BOOLEAN DEFAULT TRUE,
    code_optional BOOLEAN DEFAULT TRUE,

    -- Label print settings
    label_width INTEGER DEFAULT 50,
    label_height INTEGER DEFAULT 30,
    font_size INTEGER DEFAULT 10,
    barcode_enabled BOOLEAN DEFAULT TRUE,
    barcode_format VARCHAR(20) DEFAULT 'CODE128',

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Insert default configurations
INSERT INTO special_sample_configs (sample_type, prefix, default_separator, barcode_enabled)
VALUES
    ('SC', 'SC', '-', true),
    ('QC', 'QC', '-', true),
    ('BLANK', 'BLK', '-', true),
    ('OTHER', 'OTH', '-', true)
ON CONFLICT (sample_type) DO NOTHING;
