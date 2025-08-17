# LIMS前端系统

基于Next.js和Tailwind CSS的实验室信息管理系统前端。

## 安装和配置

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 3. 运行开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看应用。

## 项目结构

```
frontend/
├── components/       # UI组件
├── pages/           # 页面路由
├── lib/             # 工具函数和API
├── store/           # 状态管理
├── styles/          # 全局样式
└── public/          # 静态资源
```

## 主要功能模块

1. **用户认证**
   - 登录/登出
   - 角色权限管理

2. **项目管理**
   - 创建项目
   - 项目列表
   - 项目配置

3. **样本管理**
   - 样本接收
   - 样本查询
   - 样本领用/归还
   - 样本转移/销毁

4. **统计报表**
   - 存取记录
   - 样本统计

5. **审计日志**
   - 操作记录查询
   - 审计追踪

## 开发说明

- 使用TypeScript进行类型检查
- 使用React Query进行数据获取和缓存
- 使用Zustand进行状态管理
- 使用React Hook Form处理表单
- 所有UI组件基于提供的Catalyst组件库
