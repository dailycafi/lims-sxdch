// Tab 系统类型定义

import { ComponentType } from 'react'

/**
 * 单个 Tab 的状态
 */
export interface TabState {
  /** 唯一标识 (e.g., "samples-query-1704067200000") */
  id: string
  /** 模块路径 (e.g., "/samples") */
  moduleKey: string
  /** 显示标题 */
  title: string
  /** 图标标识 */
  icon?: string
  /** URL 参数 */
  params?: Record<string, unknown>
  /** 保存的组件状态 */
  state?: Record<string, unknown>
  /** 滚动位置 */
  scrollPosition?: number
  /** 是否有未保存更改 */
  isDirty: boolean
  /** 创建时间戳 */
  createdAt: number
}

/**
 * 打开 Tab 的选项
 */
export interface OpenTabOptions {
  /** 自定义 Tab ID (否则自动生成) */
  id?: string
  /** 自定义标题 (否则使用模块默认标题) */
  title?: string
  /** URL 参数 */
  params?: Record<string, unknown>
  /** 初始状态 */
  initialState?: Record<string, unknown>
  /** 是否强制创建新 Tab (即使已存在相同模块的 Tab) */
  forceNew?: boolean
}

/**
 * Tab 内容组件的 Props
 */
export interface TabContentProps {
  /** Tab ID */
  tabId: string
  /** 传入的参数 */
  params?: Record<string, unknown>
  /** 当前 Tab 是否活动 */
  isActive: boolean
}

/**
 * Tab 模块配置
 */
export interface TabModuleConfig {
  /** 懒加载的组件 */
  component: ComponentType<TabContentProps>
  /** 默认标题 */
  title: string
  /** 图标组件名称 */
  icon?: string
  /** 是否允许多实例 */
  allowMultiple: boolean
}

/**
 * Tab Store 状态和方法
 */
export interface TabsStore {
  /** 所有打开的 Tabs */
  tabs: TabState[]
  /** 当前活动的 Tab ID */
  activeTabId: string | null

  /**
   * 打开一个 Tab
   * @returns 打开的 Tab ID
   */
  openTab: (moduleKey: string, options?: OpenTabOptions) => string

  /**
   * 关闭一个 Tab
   * @returns 是否成功关闭 (可能因未保存更改被取消)
   */
  closeTab: (tabId: string, force?: boolean) => boolean

  /**
   * 切换到指定 Tab
   */
  switchTab: (tabId: string) => void

  /**
   * 更新 Tab 状态
   */
  updateTabState: (tabId: string, state: Partial<TabState>) => void

  /**
   * 设置 Tab 的脏状态
   */
  setTabDirty: (tabId: string, isDirty: boolean) => void

  /**
   * 保存滚动位置
   */
  saveScrollPosition: (tabId: string, position: number) => void

  /**
   * 关闭其他所有 Tab
   */
  closeOtherTabs: (tabId: string) => void

  /**
   * 关闭所有 Tab
   */
  closeAllTabs: () => void

  /**
   * 获取有脏状态的 Tab 数量
   */
  getDirtyTabsCount: () => number

  /**
   * 通过模块路径查找已存在的 Tab
   */
  findTabByModuleKey: (moduleKey: string) => TabState | undefined
}

/**
 * 未保存更改对话框的操作类型
 */
export type UnsavedChangesAction = 'save' | 'discard' | 'cancel'
