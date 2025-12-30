-- 添加 primary_codes 字段到 sample_types 表
-- 用于存储正份代码的逗号分隔列表，如：a1,a2,a3,a4

ALTER TABLE sample_types 
ADD COLUMN IF NOT EXISTS primary_codes VARCHAR;

-- 更新注释说明字段用途
COMMENT ON COLUMN sample_types.cycle_group IS '周期/组别 (临床用) - 逗号分隔';
COMMENT ON COLUMN sample_types.test_type IS '检测类型 (通用) - 逗号分隔';
COMMENT ON COLUMN sample_types.code IS '代码 (STB/QC用) - 逗号分隔';
COMMENT ON COLUMN sample_types.primary_codes IS '正份代码 (临床用) - 逗号分隔，如：a1,a2,a3,a4';

