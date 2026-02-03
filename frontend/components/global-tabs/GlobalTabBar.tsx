import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { useTabsStore } from '@/store/tabs'
import { TabItem } from './TabItem'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'

/**
 * 全局 Tab 栏组件
 * 功能: 水平可滚动 Tab 栏、关闭按钮、脏状态指示器、右键菜单
 */
export function GlobalTabBar() {
  const { tabs, activeTabId, switchTab, closeTab, closeOtherTabs, closeAllTabs } =
    useTabsStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null)

  // 检查是否需要显示滚动箭头
  const checkScrollArrows = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 1)
  }, [])

  // 监听滚动和窗口大小变化
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    checkScrollArrows()
    container.addEventListener('scroll', checkScrollArrows)
    window.addEventListener('resize', checkScrollArrows)

    return () => {
      container.removeEventListener('scroll', checkScrollArrows)
      window.removeEventListener('resize', checkScrollArrows)
    }
  }, [checkScrollArrows, tabs.length])

  // 滚动到活动 Tab
  useEffect(() => {
    if (!activeTabId || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const activeTab = container.querySelector(`[data-tab-id="${activeTabId}"]`)
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeTabId])

  // 滚动处理
  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return

    const scrollAmount = 200
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  // 处理关闭 Tab
  const handleClose = (tabId: string) => {
    const success = closeTab(tabId)
    if (!success) {
      // Tab 有未保存更改，显示确认对话框
      setPendingCloseTabId(tabId)
    }
  }

  // 处理未保存更改对话框的操作
  const handleUnsavedAction = (action: 'save' | 'discard' | 'cancel') => {
    if (!pendingCloseTabId) return

    if (action === 'discard') {
      closeTab(pendingCloseTabId, true)
    }
    // save 操作需要由具体页面实现，这里暂时和 discard 一样处理
    // 实际应用中，save 应该触发页面的保存逻辑

    setPendingCloseTabId(null)
  }

  if (tabs.length === 0) {
    return null
  }

  return (
    <>
      <div className="relative flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        {/* 左滚动箭头 */}
        <AnimatePresence>
          {showLeftArrow && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scroll('left')}
              className="absolute left-0 z-20 flex items-center justify-center w-8 h-full bg-gradient-to-r from-zinc-50 via-zinc-50 to-transparent dark:from-zinc-900 dark:via-zinc-900 hover:from-zinc-100 dark:hover:from-zinc-800"
            >
              <ChevronLeftIcon className="w-5 h-5 text-zinc-500" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Tab 列表 */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center overflow-x-auto scrollbar-hide px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex items-center gap-1 py-1">
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClick={() => switchTab(tab.id)}
                onClose={() => handleClose(tab.id)}
                onCloseOthers={() => closeOtherTabs(tab.id)}
                onCloseAll={closeAllTabs}
              />
            ))}
          </div>
        </div>

        {/* 右滚动箭头 */}
        <AnimatePresence>
          {showRightArrow && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scroll('right')}
              className="absolute right-0 z-20 flex items-center justify-center w-8 h-full bg-gradient-to-l from-zinc-50 via-zinc-50 to-transparent dark:from-zinc-900 dark:via-zinc-900 hover:from-zinc-100 dark:hover:from-zinc-800"
            >
              <ChevronRightIcon className="w-5 h-5 text-zinc-500" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* 未保存更改确认对话框 */}
      <UnsavedChangesDialog
        isOpen={pendingCloseTabId !== null}
        onAction={handleUnsavedAction}
        tabTitle={tabs.find((t) => t.id === pendingCloseTabId)?.title || ''}
      />
    </>
  )
}
