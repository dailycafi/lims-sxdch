-- 创建试验组表
CREATE TABLE IF NOT EXISTS test_groups (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 基本信息
    name VARCHAR(255),
    cycle VARCHAR(255),
    dosage VARCHAR(255),
    
    -- 受试者编号配置
    planned_count INTEGER DEFAULT 0,
    backup_count INTEGER DEFAULT 0,
    subject_prefix VARCHAR(50),
    subject_start_number INTEGER DEFAULT 1,
    
    -- 检测配置（支持多个检测类型）
    -- 格式: [{"test_type": "PK", "sample_type": "血浆", "primary_sets": 4, "backup_sets": 2}, ...]
    detection_configs JSONB,
    
    -- 采集点配置（JSON 存储）
    collection_points JSONB,
    
    -- 状态
    is_confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by INTEGER REFERENCES users(id),
    
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_test_groups_project_id ON test_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_test_groups_is_active ON test_groups(is_active);

-- 创建采集点表（全局配置）
CREATE TABLE IF NOT EXISTS collection_points (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_collection_points_project_id ON collection_points(project_id);
CREATE INDEX IF NOT EXISTS idx_collection_points_is_active ON collection_points(is_active);

-- 添加注释
COMMENT ON TABLE test_groups IS '试验组表 - 存储项目的临床试验信息';
COMMENT ON COLUMN test_groups.cycle IS '周期（从全局参数选择）';
COMMENT ON COLUMN test_groups.dosage IS '剂量（手动输入）';
COMMENT ON COLUMN test_groups.planned_count IS '计划例数';
COMMENT ON COLUMN test_groups.backup_count IS '备份例数';
COMMENT ON COLUMN test_groups.subject_prefix IS '受试者编号前缀（如 R）';
COMMENT ON COLUMN test_groups.subject_start_number IS '起始编号（如 1 表示 001）';
COMMENT ON COLUMN test_groups.detection_configs IS '检测配置列表 JSON，支持多个检测类型';
COMMENT ON COLUMN test_groups.collection_points IS '采集点配置 JSON';
COMMENT ON COLUMN test_groups.is_confirmed IS '是否已确认（确认后锁定）';

COMMENT ON TABLE collection_points IS '采集点表 - 存储采集点配置';
COMMENT ON COLUMN collection_points.code IS '采集点代码（如 C1, C2）';
COMMENT ON COLUMN collection_points.name IS '采集点名称（如 D1-0h, D1-1h）';
