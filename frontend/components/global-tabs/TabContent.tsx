import { memo } from 'react'
import type { TabState } from '@/types/tabs'
import { TAB_MODULES } from '@/config/tab-modules'

interface TabContentProps {
  tab: TabState
  isActive: boolean
}

/**
 * Tab 内容渲染组件
 * 使用 memo 优化渲染性能，避免非活动 Tab 的不必要重渲染
 */
export const TabContent = memo(function TabContent({
  tab,
  isActive,
}: TabContentProps) {
  const moduleConfig = TAB_MODULES[tab.moduleKey]

  if (!moduleConfig) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <p className="text-zinc-500">未知模块: {tab.moduleKey}</p>
        </div>
      </div>
    )
  }

  const Component = moduleConfig.component

  return (
    <div className="p-4 sm:p-6">
      <Component
        tabId={tab.id}
        params={tab.params}
        isActive={isActive}
      />
    </div>
  )
})
