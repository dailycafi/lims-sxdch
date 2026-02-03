import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { TabState } from '@/types/tabs'
import { XMarkIcon } from '@heroicons/react/20/solid'

interface TabItemProps {
  tab: TabState
  isActive: boolean
  onClick: () => void
  onClose: () => void
  onCloseOthers: () => void
  onCloseAll: () => void
}

/**
 * 单个 Tab 项组件
 * 功能: 点击切换、关闭按钮、脏状态指示、右键菜单
 */
export function TabItem({
  tab,
  isActive,
  onClick,
  onClose,
  onCloseOthers,
  onCloseAll,
}: TabItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setShowContextMenu(false)
      }
    }

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showContextMenu])

  // 处理关闭按钮点击
  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }

  return (
    <>
      <motion.div
        layout
        data-tab-id={tab.id}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={clsx(
          'group relative flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer select-none transition-colors min-w-[120px] max-w-[200px]',
          isActive
            ? 'bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
        )}
      >
        {/* Tab 标题 */}
        <span
          className={clsx(
            'flex-1 truncate text-sm',
            isActive
              ? 'text-zinc-900 dark:text-white font-medium'
              : 'text-zinc-600 dark:text-zinc-400'
          )}
        >
          {tab.title}
        </span>

        {/* 脏状态指示器 */}
        {tab.isDirty && (
          <span
            className={clsx(
              'w-2 h-2 rounded-full flex-shrink-0',
              isActive ? 'bg-blue-500' : 'bg-zinc-400'
            )}
            title="有未保存的更改"
          />
        )}

        {/* 关闭按钮 */}
        <button
          onClick={handleCloseClick}
          className={clsx(
            'flex-shrink-0 p-0.5 rounded transition-colors',
            isActive
              ? 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-700'
              : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100'
          )}
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </motion.div>

      {/* 右键菜单 */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 py-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 min-w-[140px]"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        >
          <button
            onClick={() => {
              onClose()
              setShowContextMenu(false)
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            关闭
          </button>
          <button
            onClick={() => {
              onCloseOthers()
              setShowContextMenu(false)
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            关闭其他
          </button>
          <button
            onClick={() => {
              onCloseAll()
              setShowContextMenu(false)
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            关闭所有
          </button>
        </div>
      )}
    </>
  )
}
