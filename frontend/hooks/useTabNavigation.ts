import { useCallback } from 'react'
import { useTabsStore } from '@/store/tabs'
import { isTabEnabled } from '@/config/tab-modules'
import type { OpenTabOptions } from '@/types/tabs'

/**
 * Tab 导航 Hook
 *
 * 替代 router.push，打开 Tab 而非进行路由导航。
 * 如果目标路径不支持 Tab，则不执行任何操作。
 *
 * @returns 导航相关方法
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { navigate, openTab, isTabPath } = useTabNavigation()
 *
 *   // 导航到样本查询（打开 Tab）
 *   const handleViewSamples = () => {
 *     navigate('/samples', { params: { filter: 'active' } })
 *   }
 *
 *   // 检查路径是否支持 Tab
 *   const canOpenAsTab = isTabPath('/samples')
 *
 *   return <button onClick={handleViewSamples}>查看样本</button>
 * }
 * ```
 */
export function useTabNavigation() {
  const { openTab: storeOpenTab, tabs, activeTabId, switchTab } = useTabsStore()

  /**
   * 导航到指定路径
   * 如果路径支持 Tab，则打开 Tab；否则不执行操作
   */
  const navigate = useCallback(
    (path: string, options?: OpenTabOptions) => {
      if (!isTabEnabled(path)) {
        console.warn(`[useTabNavigation] Path "${path}" is not tab-enabled`)
        return ''
      }

      return storeOpenTab(path, options)
    },
    [storeOpenTab]
  )

  /**
   * 打开一个 Tab（别名方法）
   */
  const openTab = useCallback(
    (path: string, options?: OpenTabOptions) => {
      return navigate(path, options)
    },
    [navigate]
  )

  /**
   * 检查路径是否支持 Tab
   */
  const isTabPath = useCallback((path: string) => {
    return isTabEnabled(path)
  }, [])

  /**
   * 获取当前活动的 Tab
   */
  const getActiveTab = useCallback(() => {
    if (!activeTabId) return null
    return tabs.find((t) => t.id === activeTabId) || null
  }, [tabs, activeTabId])

  /**
   * 切换到已存在的 Tab（通过模块路径）
   */
  const navigateToExisting = useCallback(
    (moduleKey: string) => {
      const existingTab = tabs.find((t) => t.moduleKey === moduleKey)
      if (existingTab) {
        switchTab(existingTab.id)
        return true
      }
      return false
    },
    [tabs, switchTab]
  )

  return {
    navigate,
    openTab,
    isTabPath,
    getActiveTab,
    navigateToExisting,
    tabs,
    activeTabId,
  }
}
