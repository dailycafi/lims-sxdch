-- 添加备用人员编号规则字段
-- 这些字段用于配置备用人员的编号规则，与受试者编号规则结构相同

-- 添加备用人员编号前缀字段
ALTER TABLE test_groups
ADD COLUMN IF NOT EXISTS backup_subject_prefix VARCHAR(50);

-- 添加备用人员起始编号字段
ALTER TABLE test_groups
ADD COLUMN IF NOT EXISTS backup_subject_start_number INTEGER DEFAULT 1;

-- 添加备用人员数量字段
ALTER TABLE test_groups
ADD COLUMN IF NOT EXISTS backup_subject_count INTEGER DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN test_groups.backup_subject_prefix IS '备用人员编号前缀（如 B）';
COMMENT ON COLUMN test_groups.backup_subject_start_number IS '备用人员起始编号（如 1 表示 001）';
COMMENT ON COLUMN test_groups.backup_subject_count IS '备用人员数量';
