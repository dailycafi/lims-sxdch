import { lazy, ComponentType, createElement } from 'react'
import type { TabModuleConfig, TabContentProps } from '@/types/tabs'

/**
 * 懒加载组件包装器
 * 将普通页面组件转换为支持 TabContentProps 的组件
 */
function wrapPageComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>
): ComponentType<TabContentProps> {
  const LazyComponent = lazy(importFn)
  return function TabWrappedComponent(props: TabContentProps) {
    return createElement(LazyComponent, props)
  }
}

/**
 * Tab 模块注册表
 * 定义所有支持 Tab 的模块及其配置
 */
export const TAB_MODULES: Record<string, TabModuleConfig> = {
  // 工作台
  '/tasks': {
    component: wrapPageComponent(() => import('@/pages/tasks')),
    title: '任务中心',
    icon: 'ClipboardDocumentCheckIcon',
    allowMultiple: false,
  },
  '/projects': {
    component: wrapPageComponent(() => import('@/pages/projects')),
    title: '项目管理',
    icon: 'FolderIcon',
    allowMultiple: false,
  },
  '/projects/new': {
    component: wrapPageComponent(() => import('@/pages/projects/new')),
    title: '新建项目',
    icon: 'PlusIcon',
    allowMultiple: true,
  },
  '/labels': {
    component: wrapPageComponent(() => import('@/pages/labels')),
    title: '标签管理',
    icon: 'TagIcon',
    allowMultiple: false,
  },

  // 样本管理
  '/samples/receive': {
    component: wrapPageComponent(() => import('@/pages/samples/receive')),
    title: '样本接收',
    icon: 'BeakerIcon',
    allowMultiple: true,
  },
  '/samples/inventory': {
    component: wrapPageComponent(() => import('@/pages/samples/inventory')),
    title: '清点入库',
    icon: 'ClipboardDocumentListIcon',
    allowMultiple: true,
  },
  '/storage': {
    component: wrapPageComponent(() => import('@/pages/storage')),
    title: '存储设备',
    icon: 'ArchiveBoxIcon',
    allowMultiple: false,
  },
  '/samples/borrow': {
    component: wrapPageComponent(() => import('@/pages/samples/borrow')),
    title: '样本作业',
    icon: 'ArrowUpOnSquareIcon',
    allowMultiple: false,
  },
  '/samples/transfer': {
    component: wrapPageComponent(() => import('@/pages/samples/transfer')),
    title: '样本转移',
    icon: 'ArrowsRightLeftIcon',
    allowMultiple: true,
  },
  '/samples/destroy': {
    component: wrapPageComponent(() => import('@/pages/samples/destroy')),
    title: '样本销毁',
    icon: 'TrashIcon',
    allowMultiple: true,
  },
  '/samples/tracking': {
    component: wrapPageComponent(() => import('@/pages/samples/tracking')),
    title: '跟踪表',
    icon: 'DocumentTextIcon',
    allowMultiple: false,
  },
  '/samples': {
    component: wrapPageComponent(() => import('@/pages/samples')),
    title: '样本查询',
    icon: 'MagnifyingGlassIcon',
    allowMultiple: false,
  },
  '/blank-matrix': {
    component: wrapPageComponent(() => import('@/pages/blank-matrix')),
    title: '空白基质',
    icon: 'CircleStackIcon',
    allowMultiple: false,
  },

  // 统计分析
  '/statistics': {
    component: wrapPageComponent(() => import('@/pages/statistics')),
    title: '统计查询',
    icon: 'ChartBarIcon',
    allowMultiple: false,
  },
  '/deviation': {
    component: wrapPageComponent(() => import('@/pages/deviation')),
    title: '偏差管理',
    icon: 'ExclamationTriangleIcon',
    allowMultiple: false,
  },
  '/archive': {
    component: wrapPageComponent(() => import('@/pages/archive')),
    title: '项目归档',
    icon: 'ArchiveBoxIcon',
    allowMultiple: false,
  },
  '/archive/samples': {
    component: wrapPageComponent(() => import('@/pages/archive/samples')),
    title: '样本归档',
    icon: 'ArchiveBoxIcon',
    allowMultiple: false,
  },

  // 系统管理
  '/settings': {
    component: wrapPageComponent(() => import('@/pages/settings')),
    title: '系统设置',
    icon: 'Cog6ToothIcon',
    allowMultiple: false,
  },
  '/global-params': {
    component: wrapPageComponent(() => import('@/pages/global-params')),
    title: '全局参数',
    icon: 'CircleStackIcon',
    allowMultiple: false,
  },
  '/audit': {
    component: wrapPageComponent(() => import('@/pages/audit')),
    title: '审计日志',
    icon: 'DocumentTextIcon',
    allowMultiple: false,
  },

  // 个人中心
  '/profile': {
    component: wrapPageComponent(() => import('@/pages/profile')),
    title: '个人信息',
    icon: 'UserIcon',
    allowMultiple: false,
  },
}

/**
 * 检查路径是否支持 Tab
 */
export function isTabEnabled(path: string): boolean {
  return path in TAB_MODULES
}

/**
 * 获取模块配置
 */
export function getModuleConfig(moduleKey: string): TabModuleConfig | undefined {
  return TAB_MODULES[moduleKey]
}
