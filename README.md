# LIMS - 实验室信息管理系统

一个完整的实验室信息管理系统，包含样本管理、项目管理、用户权限、审计追踪等功能。

## 系统架构

- **后端**: FastAPI + PostgreSQL + SQLAlchemy
- **前端**: Next.js + TypeScript + Tailwind CSS
- **认证**: JWT Token
- **API文档**: 自动生成的Swagger UI

## 快速开始

### 1. 后端设置

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 配置数据库连接
cp .env.example .env
# 编辑 .env 文件，填入数据库连接信息

# 初始化数据库
python init_db.py

# 启动后端服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

访问 http://localhost:8002/docs 查看API文档

### 2. 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3002 查看应用

## 默认账号

- 管理员: admin / admin123
- 样本管理员: sample_admin / sample123

## 主要功能

### 权限管理
- 7种用户角色，每个角色有不同的权限
- 基于JWT的身份认证
- 角色权限控制

### 项目管理
- 创建和管理实验项目
- 样本编号规则配置
- 项目归档

### 样本管理
- 样本接收和清点
- 样本入库和存储位置管理
- 样本领用/归还流程
- 样本转移和销毁
- 批量操作支持

### 审计追踪
- 所有操作记录
- 电子签名
- 不可删除的审计日志
- 操作时间、操作人、操作内容追踪

### 统计查询
- 样本存取记录
- 暴露时间计算
- 多维度数据查询

## 开发指南

### 后端开发
- 使用异步SQLAlchemy进行数据库操作
- 使用Pydantic进行数据验证
- 遵循RESTful API设计原则

### 前端开发
- 使用TypeScript确保类型安全
- 使用提供的Catalyst组件库
- 响应式设计，支持移动端

## 部署说明

1. 使用Docker部署（推荐）
2. 配置Nginx反向代理
3. 使用PostgreSQL数据库
4. 配置SSL证书

## 许可证

本项目仅供内部使用。
