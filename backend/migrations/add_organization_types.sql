-- 添加组织类型表
CREATE TABLE IF NOT EXISTS organization_types (
    id SERIAL PRIMARY KEY,
    value VARCHAR NOT NULL UNIQUE,
    label VARCHAR NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_organization_types_value ON organization_types(value);
CREATE INDEX IF NOT EXISTS idx_organization_types_active ON organization_types(is_active);
CREATE INDEX IF NOT EXISTS idx_organization_types_order ON organization_types(display_order);

-- 插入默认的组织类型
INSERT INTO organization_types (value, label, display_order, is_system, is_active) VALUES
    ('sponsor', '申办方', 1, TRUE, TRUE),
    ('clinical', '临床机构', 2, TRUE, TRUE),
    ('testing', '检测单位', 3, TRUE, TRUE),
    ('transport', '运输单位', 4, TRUE, TRUE)
ON CONFLICT (value) DO NOTHING;

