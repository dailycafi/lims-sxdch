# LIMS后端系统

基于FastAPI和PostgreSQL的实验室信息管理系统后端。

## 安装和配置

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/lims_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### 3. 初始化数据库

```bash
python init_db.py
```

这将创建所有数据表并添加默认用户：
- 管理员: admin / admin123
- 样本管理员: sample_admin / sample123

### 4. 运行服务器

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

## API文档

启动服务器后，访问以下地址查看API文档：
- Swagger UI: http://localhost:8002/docs
- ReDoc: http://localhost:8002/redoc

## 项目结构

```
backend/
├── app/
│   ├── api/          # API路由
│   ├── core/         # 核心配置
│   ├── models/       # 数据库模型
│   └── schemas/      # Pydantic模式
├── alembic/          # 数据库迁移
├── tests/            # 测试
└── main.py          # 应用入口
```

## 用户角色

- **系统管理员** (SYSTEM_ADMIN): 拥有所有权限
- **研究室主任** (LAB_DIRECTOR): 审批权限
- **分析测试主管** (TEST_MANAGER): 审批权限
- **样本管理员** (SAMPLE_ADMIN): 样本和项目管理
- **项目负责人** (PROJECT_LEAD): 样本申请和管理
- **分析测试员** (ANALYST): 样本申请和使用
- **QA**: 质量审核权限
