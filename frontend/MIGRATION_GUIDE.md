# API 服务迁移指南

本指南说明如何从直接使用 `api` 实例迁移到使用新的服务层。

## 架构说明

新的 API 服务层采用了以下最佳实践：

1. **类型安全**：所有 API 调用都有完整的 TypeScript 类型定义
2. **模块化**：每个业务模块都有独立的服务类
3. **集中管理**：所有 API 调用都通过服务层，便于维护和测试
4. **错误处理**：统一的错误处理机制（在 `lib/api.ts` 中配置）

## 目录结构

```
frontend/
├── services/             # API 服务层
│   ├── auth.service.ts
│   ├── projects.service.ts
│   ├── samples.service.ts
│   ├── global-params.service.ts
│   ├── users.service.ts
│   ├── audit.service.ts
│   ├── deviations.service.ts
│   ├── statistics.service.ts
│   ├── archive.service.ts
│   └── index.ts
├── types/
│   └── api.ts           # API 类型定义
└── lib/
    └── api.ts           # Axios 实例配置
```

## 迁移示例

### 1. 认证相关

**旧代码：**
```typescript
// pages/login.tsx
const formData = new FormData();
formData.append('username', username);
formData.append('password', password);

const response = await api.post('/auth/login', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
```

**新代码：**
```typescript
// pages/login.tsx
import { AuthService } from '@/services';

const response = await AuthService.login({
  username,
  password
});
```

### 2. 项目管理

**旧代码：**
```typescript
// pages/projects/index.tsx
const response = await api.get('/projects');
const projects = response.data;
```

**新代码：**
```typescript
// pages/projects/index.tsx
import { ProjectsService } from '@/services';

const projects = await ProjectsService.getProjects();
```

### 3. 样本管理

**旧代码：**
```typescript
// pages/samples/receive.tsx
const response = await api.post('/samples/receive', samplesData);
```

**新代码：**
```typescript
// pages/samples/receive.tsx
import { SamplesService } from '@/services';

const samples = await SamplesService.receiveSamples(samplesData);
```

### 4. 全局参数

**旧代码：**
```typescript
// pages/global-params/index.tsx
const [orgsRes, sampleTypesRes] = await Promise.all([
  api.get('/global-params/organizations'),
  api.get('/global-params/sample-types'),
]);
```

**新代码：**
```typescript
// pages/global-params/index.tsx
import { GlobalParamsService } from '@/services';

const [organizations, sampleTypes] = await Promise.all([
  GlobalParamsService.getOrganizations(),
  GlobalParamsService.getSampleTypes(),
]);
```

### 5. 使用统一的 API 对象

您也可以使用统一的 API 对象：

```typescript
import { API } from '@/services';

// 使用点语法访问不同的服务
const user = await API.auth.getCurrentUser();
const projects = await API.projects.getProjects();
const samples = await API.samples.getSamples();
```

## 错误处理

错误处理仍然在 `lib/api.ts` 的拦截器中统一处理，所以您不需要在每个服务调用中单独处理常见错误：

```typescript
try {
  const projects = await ProjectsService.getProjects();
  // 处理成功情况
} catch (error) {
  // 只需要处理特定的业务错误
  console.error('Failed to fetch projects:', error);
}
```

## React Query 集成

如果您使用 React Query，可以这样集成：

```typescript
import { useQuery } from '@tanstack/react-query';
import { ProjectsService } from '@/services';

// 在组件中
const { data: projects, isLoading } = useQuery({
  queryKey: ['projects'],
  queryFn: () => ProjectsService.getProjects(),
});
```

## 优势

1. **更好的代码提示**：IDE 可以提供完整的方法和参数提示
2. **类型安全**：所有请求和响应都有类型定义
3. **易于测试**：可以轻松 mock 服务层进行单元测试
4. **统一的 API 文档**：服务方法即文档
5. **易于维护**：API 端点变更只需修改服务层

## 逐步迁移建议

1. 先迁移新功能使用服务层
2. 逐个页面进行迁移，确保功能正常
3. 使用 TypeScript 的类型检查确保迁移正确
4. 迁移完成后删除旧的 API 调用代码
