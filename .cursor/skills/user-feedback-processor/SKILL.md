---
name: user-feedback-processor
description: 处理用户反馈文档（doc/docx）并修改项目代码。当用户拖入反馈文档、提到"用户反馈"、"修改需求"、"docx"、"反馈文档"时触发。解析文档中的文字和截图，根据反馈内容自动判断修改前端或后端代码，确保 UI/UX 符合最佳实践，并使用 agent-browser 进行测试验证。
---

# 用户反馈处理器

处理用户反馈文档，根据反馈内容修改 LIMS 项目的前端和/或后端代码。

## 快速开始

1. 用户将 `.docx` 文件放入 `feedback-docs/` 目录
2. 告诉 AI："请处理 feedback-docs/xxx.docx 中的反馈"
3. AI 自动解析文档、分析修改需求、实施修改、测试验证

## 工作流程

### 第一步：解析反馈文档

使用 Python 脚本解析 docx 文件：

```bash
python .cursor/skills/user-feedback-processor/scripts/parse_docx.py feedback-docs/<文档名>.docx
```

脚本会输出：
- 文档的文字内容（Markdown 格式）
- 提取的图片保存到 `feedback-docs/images/` 目录

**重要**：仔细查看提取的图片，用户通常会在截图上标注问题区域。

### 第二步：分析反馈内容

根据反馈内容判断修改范围：

| 反馈关键词 | 修改范围 | 涉及目录 |
|-----------|---------|---------|
| 界面、样式、按钮、表格、表单、布局、显示 | 前端 | `frontend/` |
| 接口、数据、字段、权限、逻辑、报错 | 后端 | `backend/` |
| 流程、功能、业务 | 可能两者都需要 | 两者 |

### 第三步：定位相关代码

#### 前端代码结构

| 类型 | 路径 |
|-----|------|
| 页面 | `frontend/pages/**/*.tsx` |
| 组件 | `frontend/components/*.tsx` |
| 布局 | `frontend/components/layouts/` |
| 服务 | `frontend/services/*.service.ts` |
| 状态 | `frontend/store/*.ts` |
| 样式 | `frontend/styles/globals.css` |
| 类型 | `frontend/types/*.ts` |

#### 后端代码结构

| 类型 | 路径 |
|-----|------|
| API 端点 | `backend/app/api/v1/endpoints/*.py` |
| 数据模型 | `backend/app/models/*.py` |
| 请求/响应 | `backend/app/schemas/*.py` |
| 业务服务 | `backend/app/services/*.py` |
| 认证权限 | `backend/app/api/v1/deps.py` |

### 第四步：实施修改

#### 前端修改检查清单

**UI/UX 最佳实践**：
- [ ] 与现有 UI 风格一致（Tailwind CSS + Headless UI）
- [ ] 响应式布局正确
- [ ] 可访问性：label、aria-label、颜色对比度
- [ ] 反馈及时：loading 状态、toast 提示、表单验证
- [ ] 动画流畅：使用 framer-motion

**代码质量**：
- [ ] TypeScript 类型正确
- [ ] 使用现有组件，不重复造轮子
- [ ] 状态管理用 zustand 或 react-query
- [ ] API 调用通过 services

#### 后端修改检查清单

**API 设计最佳实践**：
- [ ] RESTful 规范：正确的 HTTP 方法和状态码
- [ ] Pydantic schema 验证请求
- [ ] 统一响应格式
- [ ] 敏感操作需认证

**代码质量**：
- [ ] 类型注解完整
- [ ] 异常处理得当
- [ ] 使用 async/await
- [ ] 遵循现有代码规范

### 第五步：测试验证

使用 `agent-browser` 进行前端测试：

```bash
# 1. 启动开发服务器（如未运行）
cd frontend && npm run dev &
cd backend && uvicorn app.main:app --reload --port 8000 &

# 2. 打开相关页面
agent-browser open http://localhost:3002/<页面路径>

# 3. 获取页面快照
agent-browser snapshot -i

# 4. 模拟用户操作
agent-browser click @e1
agent-browser fill @e2 "测试文本"

# 5. 截图对比
agent-browser screenshot feedback-test.png

# 6. 检查控制台错误
agent-browser console
```

### 第六步：总结修改

```markdown
## 修改摘要

### 反馈需求
- [需求1简述]
- [需求2简述]

### 前端修改
- `frontend/pages/xxx.tsx`: 修改描述
- `frontend/components/xxx.tsx`: 修改描述

### 后端修改
- `backend/app/api/v1/endpoints/xxx.py`: 修改描述
- `backend/app/schemas/xxx.py`: 修改描述

### UI/UX 改进
- 改进点1
- 改进点2

### 测试结果
- ✅ 页面正常显示
- ✅ 功能正常工作
- ✅ 无控制台错误

### 注意事项（如有）
- 需要执行的数据库迁移
- 需要更新的环境变量
```

---

## 项目技术栈

### 前端
- Next.js 16 + React 19
- Tailwind CSS 3 + Headless UI 2
- Zustand 4 + React Query 5
- React Hook Form 7
- Framer Motion 11

### 后端
- FastAPI 0.128
- SQLAlchemy 2.0 (async) + PostgreSQL
- Pydantic 2.12
- JWT 认证

---

## 常见修改模式

### 前端：添加表单字段

```tsx
<Field>
  <Label>新字段</Label>
  <Input {...register('newField')} />
</Field>
```

### 前端：添加表格列

```tsx
<TableHeader>新列</TableHeader>
// ...
<TableCell>{item.newField}</TableCell>
```

### 前端：添加确认弹窗

```tsx
<Dialog open={isOpen} onClose={setIsOpen}>
  <DialogTitle>确认</DialogTitle>
  <DialogBody>确认执行此操作？</DialogBody>
  <DialogActions>
    <Button onClick={() => setIsOpen(false)}>取消</Button>
    <Button color="red" onClick={handleConfirm}>确认</Button>
  </DialogActions>
</Dialog>
```

### 后端：添加 API 端点

```python
@router.post("/", response_model=schemas.ItemResponse)
async def create_item(
    item: schemas.ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_item = models.Item(**item.model_dump())
    db.add(db_item)
    await db.commit()
    return db_item
```

### 后端：添加字段

```python
# 1. models/xxx.py
new_field = Column(String, nullable=True)

# 2. schemas/xxx.py
new_field: str | None = None
```
