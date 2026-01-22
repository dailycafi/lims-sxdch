---
name: user-feedback-processor
description: 处理用户反馈文档（docx）并修改项目代码。当用户提到"用户反馈"、"修改需求"、"反馈文档"、拖入 docx 文件、或指向 feedback-docs 目录时触发。
metadata:
  version: "1.4.0"
---

# 用户反馈处理器

解析用户反馈文档，根据需求修改 LIMS 前端/后端代码，生成 PDF 修改报告。

## 核心原则

1. **先确保服务运行**：截图前必须确认前后端服务正常
2. **发现错误立即修复**：截图中看到错误时，先解决错误再继续
3. **仔细检查 UI**：每次修改后都要检查 UI 显示是否正常
4. **报告要有截图**：每条修改必须附上对应的 ROI 截图

## 工作流程

1. **解析文档** → 提取文字和图片
2. **检查服务** → 确保前后端服务正常运行
3. **分析需求** → 理解每条修改需求
4. **实施修改** → 按最佳实践修改代码
5. **验证修改** → 检查页面是否有错误和 UI 问题
6. **截图** → 为每个修改项截取 ROI 截图
7. **生成报告** → 输出 PDF 报告到 `feedback-docs/reports/`

## 第一步：解析文档

```bash
python .cursor/skills/user-feedback-processor/scripts/parse_docx.py feedback-docs/<文档>.docx
```

图片保存在 `feedback-docs/images/`，使用 Read 工具查看用户标注。

## 第二步：检查服务状态（重要！）

在截图前，**必须**检查前后端服务是否正常运行：

### 检查方法

1. **查看终端状态**：读取 `terminals/` 目录下的文件，查看是否有运行中的服务
2. **检查端口**：
   - 前端：`http://localhost:3002`
   - 后端：`http://localhost:8002`

### 启动服务（如果未运行）

**重要**：后端服务需要在 `lims` conda 环境中运行！

```bash
# 后端（需要先启动，必须激活 lims 环境）
cd backend && conda activate lims && uvicorn app.main:app --reload --port 8002

# 前端
cd frontend && npm run dev
```

### 环境要求

- **后端**：必须在 `lims` conda 环境中运行
  - 激活命令：`conda activate lims`
  - 或使用：`source activate lims`
- **前端**：Node.js 环境，使用项目的 package.json

### 等待服务就绪

启动后等待 5-10 秒，确认终端输出显示服务已就绪：
- 前端：`✓ Ready in Xs`
- 后端：`Uvicorn running on http://0.0.0.0:8002`

## 第三步：修改代码

根据需求修改代码，确保：
- 前端使用现有组件（`frontend/components/`）
- 后端遵循现有 API 规范
- UI 修改符合 Web Interface Guidelines
- 使用 `ReadLints` 检查代码是否有语法错误

### 验证前端构建

修改完成后，**必须**运行前端构建确保无错误：

```bash
cd frontend && npm run build
```

如果构建失败，根据错误信息修复代码后再次构建，直到通过。

### 检查数据库结构

如果修改涉及**后端模型**（`backend/app/models/`），需要同步更新 `init_db.py`：

1. **检查模型变更**：查看是否有新增字段、新表、或字段类型变更
2. **更新 init_db.py**：
   - 新增表：在 `init_db()` 中添加示例数据
   - 新增字段：更新现有示例数据
   - 确保测试数据完整性

3. **重建数据库**（测试环境）：
```bash
cd backend && conda activate lims && python init_db.py --drop
```

**注意**：`--drop` 会删除所有现有数据，仅在测试环境使用！

**模型文件位置**：
- `backend/app/models/` - SQLAlchemy 模型定义
- `backend/app/schemas/` - Pydantic 数据模式
- `backend/init_db.py` - 数据库初始化脚本

## 第四步：验证修改（重要！）

修改代码后，**必须**验证页面是否正常工作：

1. 刷新页面：`browser_navigate` 重新访问
2. 获取页面快照：`browser_snapshot`
3. **检查是否有运行时错误**：
   - 查找 snapshot 中的 `alert`、`dialog` 元素
   - 查找包含 "Error"、"错误"、"失败" 的文本
   - 查看浏览器控制台：`browser_console_messages`

### 常见错误及处理

| 错误类型 | 可能原因 | 解决方法 |
|---------|---------|---------|
| Network Error | 后端未启动 | 启动后端服务 |
| 404 Not Found | API 路径错误 | 检查 API 端点 |
| TypeScript Error | 类型错误 | 修复代码类型 |
| Runtime Error | 代码逻辑错误 | 检查堆栈跟踪 |

### UI 显示问题检查

**重要**：修改代码后，必须仔细检查页面的 UI 显示是否正常。常见问题包括：

- 文字被截断或裁切
- 下拉菜单、弹窗被遮挡
- 控件显示不完整或变形
- 布局错位、元素重叠
- 空状态/错误状态显示异常
- **文字不当换行**：标签、按钮、表头等短文本不应换行

发现问题时，检查相关组件的 CSS 样式（特别是 `overflow`、`width`、`z-index`、`whitespace`、`flex-shrink` 等属性）。

**常用修复方案**：
- 文字换行：添加 `whitespace-nowrap`
- 元素被压缩：添加 `flex-shrink-0`
- 内容溢出：调整 `min-width` 或父容器布局

### 如果发现错误

**重要**：发现错误时必须先修复，不能带着错误继续生成报告！

1. 截图记录错误状态
2. 分析错误原因（查看堆栈跟踪）
3. 修复代码
4. 重新验证，直到无错误

## 第五步：截图

确认页面无错误后，为每个修改项截取 ROI 截图：

```
browser_navigate → browser_snapshot → 检查错误 → browser_take_screenshot → 压缩图片
```

**截图要求**：
- 每个修改项需要对应的截图，清晰展示修改后的效果
- 如果一张截图能覆盖多个修改项，可以复用
- 保存到 `feedback-docs/reports/` 目录

### 压缩截图（重要！）

**高分辨率截图必须压缩**，否则可能导致 "image too large" 错误。

截图后立即运行压缩脚本：

```bash
# 压缩单张图片（自动转换为 JPEG，最大 1200x800）
python .cursor/skills/user-feedback-processor/scripts/compress_image.py feedback-docs/reports/screenshot.png

# 自定义参数
python .cursor/skills/user-feedback-processor/scripts/compress_image.py screenshot.png --max-width 1000 --quality 70

# 压缩目录下所有图片
python .cursor/skills/user-feedback-processor/scripts/compress_image.py feedback-docs/reports/ --all
```

**压缩参数说明**：
| 参数 | 默认值 | 说明 |
|-----|-------|------|
| `--max-width` | 1200 | 最大宽度（像素） |
| `--max-height` | 800 | 最大高度（像素） |
| `--quality` | 75 | JPEG 质量 (1-95, 越低越小) |
| `--keep-png` | false | 保持 PNG 格式不转换为 JPEG |

**典型压缩效果**：
- 2880x1800 Retina 截图 → 1200x750，约减少 80-90% 文件大小
- PNG → JPEG 转换可额外减少 50-70%

## 第六步：生成修改报告（PDF）

生成综合 PDF 报告，每条修改后直接附上对应截图。

### 报告生成步骤

1. **为每个修改项截取 ROI 截图**
   - 使用 `browser_take_screenshot` 截取相关区域
   - 保存到 `feedback-docs/reports/` 目录

2. **生成 PDF 报告**
   使用 `scripts/generate_report.py` 生成 PDF：

```bash
python .cursor/skills/user-feedback-processor/scripts/generate_report.py \
  --title "修改报告 - 标签管理" \
  --date "2026-01-22" \
  --doc "修改内容清单-20260116.docx" \
  --output "feedback-docs/reports/report.pdf" \
  --items '[
    {"id": 1, "desc": "修改描述", "status": "completed", "image": "screenshot.png"},
    {"id": 2, "desc": "修改描述", "status": "completed", "image": "screenshot2.png"}
  ]'
```

### 报告格式要求

- **标题**: 修改报告 - [功能名称]
- **元信息**: 日期、反馈文档、状态
- **每条修改**: 序号 + 修改描述 + 状态标记 + **截图**（直接嵌入 PDF）
- **修改文件列表**: 列出所有被修改的文件

## 项目结构速查

**前端**: `frontend/pages/` `frontend/components/` `frontend/services/`

**后端**: `backend/app/api/v1/endpoints/` `backend/app/models/` `backend/app/schemas/`

**报告输出**: `feedback-docs/reports/`

## 检查清单

在完成任务前，确认以下事项：

- [ ] 前后端服务正常运行（后端用 lims conda 环境）
- [ ] 代码无 lint 错误
- [ ] 页面无运行时错误（无 Network Error、无弹窗报错）
- [ ] UI 显示正常（无截断、无不当换行、无遮挡）
- [ ] **前端 build 通过**：`cd frontend && npm run build`
- [ ] **数据库结构同步**：如有模型更改，更新 `init_db.py`
- [ ] 每个修改项都有对应的 ROI 截图
- [ ] **截图已压缩**（避免 "image too large" 错误）
- [ ] 已生成 PDF 修改报告

## 常见问题速查

| 问题 | 解决方案 |
|-----|---------|
| Network Error | 启动后端：`conda activate lims && uvicorn ...` |
| 文字截断 | 检查 `overflow`、`max-width`、父容器宽度 |
| 文字换行 | 添加 `whitespace-nowrap` |
| 元素被压缩 | 添加 `flex-shrink-0` |
| 下拉菜单被遮挡 | 检查父容器 `overflow`、`z-index` |
| **image too large** | 运行 `compress_image.py` 压缩截图 |
| **数据库不同步** | 运行 `python init_db.py --drop` 重建 |
