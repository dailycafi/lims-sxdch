import { useCallback, useEffect, useRef } from 'react'
import { useTabsStore } from '@/store/tabs'

/**
 * Tab 状态管理 Hook
 *
 * 供页面组件使用，管理 Tab 内的状态。
 * 当状态变化时自动标记 Tab 为脏状态，保存后可调用 markClean() 清除脏状态。
 *
 * @param tabId - Tab 的唯一标识
 * @param initialState - 初始状态
 * @returns 状态对象和状态管理方法
 *
 * @example
 * ```tsx
 * function MyPage({ tabId }: TabContentProps) {
 *   const { state, setState, markClean, markDirty } = useTabState(tabId, {
 *     filter: '',
 *     page: 1,
 *   })
 *
 *   const handleFilterChange = (filter: string) => {
 *     setState({ filter })
 *   }
 *
 *   const handleSave = async () => {
 *     await saveData()
 *     markClean()
 *   }
 *
 *   return <div>...</div>
 * }
 * ```
 */
export function useTabState<T extends Record<string, unknown>>(
  tabId: string,
  initialState: T
) {
  const { tabs, updateTabState, setTabDirty } = useTabsStore()
  const initialStateRef = useRef(initialState)
  const isInitializedRef = useRef(false)

  // 获取当前 Tab
  const tab = tabs.find((t) => t.id === tabId)

  // 获取当前状态，如果没有则使用初始状态
  const state = (tab?.state as T) || initialState

  // 初始化状态（仅在首次渲染时）
  useEffect(() => {
    if (!isInitializedRef.current && tab && !tab.state) {
      updateTabState(tabId, { state: initialStateRef.current })
      isInitializedRef.current = true
    }
  }, [tabId, tab, updateTabState])

  // 更新状态并标记为脏状态
  const setState = useCallback(
    (updates: Partial<T>) => {
      const newState = { ...state, ...updates }
      updateTabState(tabId, { state: newState })
      setTabDirty(tabId, true)
    },
    [tabId, state, updateTabState, setTabDirty]
  )

  // 替换整个状态
  const replaceState = useCallback(
    (newState: T) => {
      updateTabState(tabId, { state: newState })
      setTabDirty(tabId, true)
    },
    [tabId, updateTabState, setTabDirty]
  )

  // 标记为干净状态（通常在保存后调用）
  const markClean = useCallback(() => {
    setTabDirty(tabId, false)
  }, [tabId, setTabDirty])

  // 手动标记为脏状态
  const markDirty = useCallback(() => {
    setTabDirty(tabId, true)
  }, [tabId, setTabDirty])

  // 重置到初始状态
  const resetState = useCallback(() => {
    updateTabState(tabId, { state: initialStateRef.current })
    setTabDirty(tabId, false)
  }, [tabId, updateTabState, setTabDirty])

  return {
    state,
    setState,
    replaceState,
    markClean,
    markDirty,
    resetState,
    isDirty: tab?.isDirty || false,
  }
}
