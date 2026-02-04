-- 空白基质接收记录表
CREATE TABLE IF NOT EXISTS blank_matrix_receive_records (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    source_name VARCHAR(255) NOT NULL,
    source_contact VARCHAR(255),
    source_phone VARCHAR(50),
    consent_files JSONB,
    ethics_files JSONB,
    medical_report_files JSONB,
    anticoagulants JSONB NOT NULL,
    matrix_type VARCHAR(50) NOT NULL,
    matrix_type_other VARCHAR(255),
    received_by INTEGER NOT NULL REFERENCES users(id),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 空白基质样本表
CREATE TABLE IF NOT EXISTS blank_matrix_samples (
    id SERIAL PRIMARY KEY,
    sample_code VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    receive_record_id INTEGER NOT NULL REFERENCES blank_matrix_receive_records(id),
    project_id INTEGER NOT NULL REFERENCES projects(id),
    anticoagulant VARCHAR(50),
    matrix_type VARCHAR(50) NOT NULL,
    edta_volume NUMERIC(10, 2),
    heparin_volume NUMERIC(10, 2),
    citrate_volume NUMERIC(10, 2),
    total_volume NUMERIC(10, 2),
    status VARCHAR(50) DEFAULT 'pending',
    special_notes TEXT,
    freezer_id VARCHAR(100),
    shelf_level VARCHAR(50),
    rack_position VARCHAR(50),
    box_code VARCHAR(100),
    box_id INTEGER REFERENCES storage_boxes(id),
    position_in_box VARCHAR(20),
    inventoried_by INTEGER REFERENCES users(id),
    inventoried_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 空白基质领用申请表
CREATE TABLE IF NOT EXISTS blank_matrix_borrow_requests (
    id SERIAL PRIMARY KEY,
    request_code VARCHAR(100) UNIQUE NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    purpose VARCHAR(255) NOT NULL,
    target_location VARCHAR(255) NOT NULL,
    target_date TIMESTAMP WITH TIME ZONE NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 空白基质领用明细表
CREATE TABLE IF NOT EXISTS blank_matrix_borrow_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES blank_matrix_borrow_requests(id),
    sample_id INTEGER NOT NULL REFERENCES blank_matrix_samples(id),
    borrowed_at TIMESTAMP WITH TIME ZONE,
    returned_at TIMESTAMP WITH TIME ZONE,
    return_status VARCHAR(50)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_blank_matrix_receive_records_project_id ON blank_matrix_receive_records(project_id);
CREATE INDEX IF NOT EXISTS idx_blank_matrix_receive_records_status ON blank_matrix_receive_records(status);
CREATE INDEX IF NOT EXISTS idx_blank_matrix_samples_project_id ON blank_matrix_samples(project_id);
CREATE INDEX IF NOT EXISTS idx_blank_matrix_samples_receive_record_id ON blank_matrix_samples(receive_record_id);
CREATE INDEX IF NOT EXISTS idx_blank_matrix_samples_status ON blank_matrix_samples(status);
CREATE INDEX IF NOT EXISTS idx_blank_matrix_samples_sample_code ON blank_matrix_samples(sample_code);
CREATE INDEX IF NOT EXISTS idx_blank_matrix_borrow_requests_project_id ON blank_matrix_borrow_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_blank_matrix_borrow_requests_status ON blank_matrix_borrow_requests(status);
