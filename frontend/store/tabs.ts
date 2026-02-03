import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TabState, TabsStore, OpenTabOptions } from '@/types/tabs'
import { TAB_MODULES } from '@/config/tab-modules'

const MAX_TABS = 20

/**
 * 生成唯一 Tab ID
 */
function generateTabId(moduleKey: string): string {
  const slug = moduleKey.replace(/\//g, '-').replace(/^-/, '')
  return `${slug}-${Date.now()}`
}

/**
 * Tab 管理 Store
 * 使用 persist middleware 支持会话恢复
 */
export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (moduleKey: string, options?: OpenTabOptions) => {
        const state = get()
        const moduleConfig = TAB_MODULES[moduleKey]

        if (!moduleConfig) {
          console.warn(`[TabsStore] Unknown module: ${moduleKey}`)
          return ''
        }

        // 如果不允许多实例且已存在相同模块的 Tab，切换到该 Tab
        if (!moduleConfig.allowMultiple && !options?.forceNew) {
          const existingTab = state.tabs.find((tab) => tab.moduleKey === moduleKey)
          if (existingTab) {
            set({ activeTabId: existingTab.id })
            return existingTab.id
          }
        }

        // 检查是否达到最大 Tab 数量
        if (state.tabs.length >= MAX_TABS) {
          // 找到最早创建且无脏状态的 Tab 关闭
          const cleanTabs = state.tabs.filter((tab) => !tab.isDirty)
          if (cleanTabs.length > 0) {
            const oldestCleanTab = cleanTabs.reduce((oldest, tab) =>
              tab.createdAt < oldest.createdAt ? tab : oldest
            )
            get().closeTab(oldestCleanTab.id, true)
          } else {
            console.warn('[TabsStore] Cannot open new tab: all tabs have unsaved changes')
            return ''
          }
        }

        // 创建新 Tab
        const tabId = options?.id || generateTabId(moduleKey)
        const newTab: TabState = {
          id: tabId,
          moduleKey,
          title: options?.title || moduleConfig.title,
          icon: moduleConfig.icon,
          params: options?.params,
          state: options?.initialState,
          scrollPosition: 0,
          isDirty: false,
          createdAt: Date.now(),
        }

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: tabId,
        }))

        return tabId
      },

      closeTab: (tabId: string, force = false) => {
        const state = get()
        const tab = state.tabs.find((t) => t.id === tabId)

        if (!tab) {
          return true
        }

        // 如果有未保存更改且非强制关闭，返回 false
        if (tab.isDirty && !force) {
          return false
        }

        const tabIndex = state.tabs.findIndex((t) => t.id === tabId)
        const newTabs = state.tabs.filter((t) => t.id !== tabId)

        // 确定新的活动 Tab
        let newActiveTabId = state.activeTabId
        if (state.activeTabId === tabId) {
          if (newTabs.length === 0) {
            newActiveTabId = null
          } else if (tabIndex >= newTabs.length) {
            // 关闭的是最后一个，激活前一个
            newActiveTabId = newTabs[newTabs.length - 1].id
          } else {
            // 激活同位置的 Tab
            newActiveTabId = newTabs[tabIndex].id
          }
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveTabId,
        })

        return true
      },

      switchTab: (tabId: string) => {
        const state = get()
        const tab = state.tabs.find((t) => t.id === tabId)

        if (tab) {
          set({ activeTabId: tabId })
        }
      },

      updateTabState: (tabId: string, updates: Partial<TabState>) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, ...updates } : tab
          ),
        }))
      },

      setTabDirty: (tabId: string, isDirty: boolean) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, isDirty } : tab
          ),
        }))
      },

      saveScrollPosition: (tabId: string, position: number) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, scrollPosition: position } : tab
          ),
        }))
      },

      closeOtherTabs: (tabId: string) => {
        const state = get()
        const currentTab = state.tabs.find((t) => t.id === tabId)

        if (!currentTab) {
          return
        }

        // 过滤掉其他没有脏状态的 Tab
        const tabsToKeep = state.tabs.filter(
          (tab) => tab.id === tabId || tab.isDirty
        )

        set({
          tabs: tabsToKeep,
          activeTabId: tabId,
        })
      },

      closeAllTabs: () => {
        const state = get()
        // 只保留有脏状态的 Tab
        const dirtyTabs = state.tabs.filter((tab) => tab.isDirty)

        if (dirtyTabs.length > 0) {
          set({
            tabs: dirtyTabs,
            activeTabId: dirtyTabs[0].id,
          })
        } else {
          set({
            tabs: [],
            activeTabId: null,
          })
        }
      },

      getDirtyTabsCount: () => {
        return get().tabs.filter((tab) => tab.isDirty).length
      },

      findTabByModuleKey: (moduleKey: string) => {
        return get().tabs.find((tab) => tab.moduleKey === moduleKey)
      },
    }),
    {
      name: 'lims-tabs-store',
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          // 不持久化滚动位置和脏状态，页面刷新后重置
          scrollPosition: 0,
          isDirty: false,
        })),
        activeTabId: state.activeTabId,
      }),
    }
  )
)
