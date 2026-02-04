# LIMS 项目 Claude Code 配置

## 技术栈

- **后端**: FastAPI + SQLAlchemy (async)
- **前端**: Next.js + React + TypeScript
- **数据库**: PostgreSQL (使用 asyncpg 驱动)
- **认证**: JWT (python-jose)

## Git Worktrees

项目使用 git worktrees 管理多个并行开发任务。

### 主仓库
- **路径**: `/Users/cafi/Workspace/lims`
- **分支**: `feature/global-tab-mechanism-v2`

### 已合并任务

以下任务已合并到主分支 `feature/global-tab-mechanism-v2`:
- task-01: global tab mechanism
- task-02: sidebar restructure
- task-03: login homepage
- task-09: subject code detail

### 任务 Worktrees

| 任务 | 路径 | 分支 | 描述 |
|------|------|------|------|
| task-04 | `worktrees/task-04` | `feature/task-04-system-settings` | 优化系统设置模块 |
| task-05 | `worktrees/task-05` | `feature/task-05-global-params` | 调整全局参数模块 |
| task-06 | `worktrees/task-06` | `feature/task-06-project-creation` | 改进项目管理-新建项目流程 |
| task-07 | `worktrees/task-07` | `feature/task-07-sample-number-drag` | 实现样本编号规则拖拽模式 |
| task-08 | `worktrees/task-08` | `feature/task-08-project-config` | 优化项目配置功能 |
| task-10 | `worktrees/task-10` | `feature/task-10-label-management` | 优化标签管理模块 |
| task-11 | `worktrees/task-11` | `feature/task-11-sample-receiving` | 增强样本接收功能 |
| task-12 | `worktrees/task-12` | `feature/task-12-inventory-check` | 改进清点模块 |
| task-13 | `worktrees/task-13` | `feature/task-13-statistics-query` | 开发统计查询模块 |
| task-14 | `worktrees/task-14` | `feature/task-14-special-samples` | 开发特殊样本模块 |
| task-15 | `worktrees/task-15` | `feature/task-15-blank-matrix` | 开发空白基质新模块 |

### Worktree 命令参考

```bash
# 查看所有 worktrees
git worktree list

# 添加新 worktree
git worktree add worktrees/task-XX -b feature/task-XX-description

# 移动 worktree
git worktree move <old-path> <new-path>

# 删除 worktree
git worktree remove <path>
```

## 项目结构

```
lims/
├── backend/          # FastAPI 后端
├── frontend/         # Next.js 前端
├── feedback-docs/    # 需求文档
│   └── tasks/        # 任务描述文件
├── worktrees/        # Git worktrees 目录
│   ├── task-04/
│   ├── task-05/
│   ├── task-06/
│   ├── task-07/
│   ├── task-08/
│   ├── task-10/
│   ├── task-11/
│   ├── task-12/
│   ├── task-13/
│   ├── task-14/
│   └── task-15/
└── CLAUDE.md         # 本文件
```
