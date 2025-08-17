# 后端配置指南

## 环境变量配置

在运行系统之前，您需要在 `backend` 目录下创建一个 `.env` 文件。

### 1. 创建 .env 文件

```bash
cd backend
```

创建 `.env` 文件并添加以下内容：

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/lims_db
SECRET_KEY=your-secret-key-here-please-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 2. 修改数据库连接信息

将 `DATABASE_URL` 中的以下部分替换为您的实际数据库信息：
- `user`: 数据库用户名
- `password`: 数据库密码
- `localhost`: 数据库主机地址
- `5432`: 数据库端口
- `lims_db`: 数据库名称

例如：
```
DATABASE_URL=postgresql+asyncpg://postgres:mypassword@localhost:5432/lims_db
```

### 3. 生成安全的密钥

为了生产环境的安全性，请生成一个随机的 SECRET_KEY：

```python
import secrets
print(secrets.token_urlsafe(32))
```

然后将生成的密钥替换 `.env` 文件中的 `SECRET_KEY` 值。

### 4. 创建数据库

确保PostgreSQL已安装并运行，然后创建数据库：

```sql
CREATE DATABASE lims_db;
```

### 5. 初始化数据库

配置完成后，运行初始化脚本：

```bash
python init_db.py
```

这将创建所有必要的数据表并添加默认用户。

## 常见问题

1. **连接数据库失败**
   - 检查PostgreSQL服务是否运行
   - 确认数据库连接信息正确
   - 确认数据库用户有足够的权限

2. **asyncpg错误**
   - 确保已安装：`pip install asyncpg`
   - 检查PostgreSQL版本兼容性

3. **密钥错误**
   - 确保SECRET_KEY已设置
   - 密钥长度建议至少32个字符
