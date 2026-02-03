import { Suspense, useRef, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import { useTabsStore } from '@/store/tabs'
import { TabContent } from './TabContent'

/**
 * 加载中占位组件
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-zinc-500">加载中...</span>
      </div>
    </div>
  )
}

/**
 * Tab 容器组件
 * 核心逻辑: 使用 CSS visibility 隐藏非活动 Tab，保持所有 Tab 组件挂载
 * 这样可以保留每个 Tab 的完整状态，包括表单数据、滚动位置等
 */
export function TabContainer() {
  const { tabs, activeTabId, saveScrollPosition } = useTabsStore()
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 保存当前 Tab 的滚动位置
  const handleScroll = useCallback(
    (tabId: string) => {
      const container = containerRefs.current.get(tabId)
      if (container) {
        saveScrollPosition(tabId, container.scrollTop)
      }
    },
    [saveScrollPosition]
  )

  // 恢复滚动位置
  useEffect(() => {
    if (activeTabId) {
      const tab = tabs.find((t) => t.id === activeTabId)
      const container = containerRefs.current.get(activeTabId)
      if (tab && container && tab.scrollPosition) {
        // 使用 requestAnimationFrame 确保 DOM 已更新
        requestAnimationFrame(() => {
          container.scrollTop = tab.scrollPosition || 0
        })
      }
    }
  }, [activeTabId, tabs])

  // 设置 ref 的回调函数
  const setContainerRef = useCallback(
    (tabId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        containerRefs.current.set(tabId, el)
      } else {
        containerRefs.current.delete(tabId)
      }
    },
    []
  )

  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId

        return (
          <div
            key={tab.id}
            ref={setContainerRef(tab.id)}
            className={clsx(
              'absolute inset-0 overflow-auto bg-white dark:bg-zinc-900',
              isActive ? 'z-10 visible' : 'z-0 invisible'
            )}
            onScroll={() => {
              if (isActive) {
                handleScroll(tab.id)
              }
            }}
          >
            <Suspense fallback={<LoadingFallback />}>
              <TabContent tab={tab} isActive={isActive} />
            </Suspense>
          </div>
        )
      })}
    </div>
  )
}
