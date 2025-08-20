import clsx from 'clsx'
import React from 'react'

interface Tab {
  key: string
  label: string
  disabled?: boolean
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={clsx('inline-flex p-1 bg-gray-100 rounded-lg', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => !tab.disabled && onChange(tab.key)}
          disabled={tab.disabled}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
            {
              'bg-white text-gray-900 shadow-sm': activeTab === tab.key,
              'text-gray-500 hover:text-gray-700': activeTab !== tab.key && !tab.disabled,
              'text-gray-400 cursor-not-allowed': tab.disabled,
            }
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
