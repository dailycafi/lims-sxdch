import clsx from 'clsx'
import React from 'react'
import { motion } from 'framer-motion'

interface Tab {
  key: string
  label: string
  icon?: React.ElementType
  disabled?: boolean
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (key: string) => void
  className?: string
  fullWidth?: boolean
}

export function Tabs({ tabs, activeTab, onChange, className, fullWidth = false }: TabsProps) {
  return (
    <div className={clsx(
      'inline-flex p-1 bg-zinc-100/80 backdrop-blur-sm rounded-xl border border-zinc-200/50',
      fullWidth && 'flex w-full',
      className
    )}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        const Icon = tab.icon

        return (
          <button
            key={tab.key}
            onClick={() => !tab.disabled && onChange(tab.key)}
            disabled={tab.disabled}
            className={clsx(
              'relative flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg outline-none',
              fullWidth && 'flex-1',
              {
                'text-zinc-900': isActive,
                'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50': !isActive && !tab.disabled,
                'text-zinc-300 cursor-not-allowed': tab.disabled,
              }
            )}
          >
            {isActive && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-0 bg-white shadow-sm border border-zinc-200 rounded-lg"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {Icon && <Icon className={clsx('h-5 w-5', isActive ? 'text-blue-600' : 'text-zinc-400')} />}
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
