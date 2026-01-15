-- 添加用户密码管理相关字段
-- 用于支持首次登录强制修改密码和密码90天过期功能

-- 添加 must_change_password 字段（首次登录需要修改密码标记）
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 添加 password_changed_at 字段（密码最后修改时间）
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- 为现有用户设置 password_changed_at 为当前时间（避免立即触发90天过期）
UPDATE users SET password_changed_at = NOW() WHERE password_changed_at IS NULL AND must_change_password = FALSE;

-- 添加注释
COMMENT ON COLUMN users.must_change_password IS '是否需要在下次登录时修改密码（首次登录或管理员重置密码后）';
COMMENT ON COLUMN users.password_changed_at IS '密码最后修改时间，用于检测90天过期';
