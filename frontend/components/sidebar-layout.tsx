'use client'

import * as Headless from '@headlessui/react'
import React, { useState } from 'react'
import { motion } from 'framer-motion'

// 汉堡菜单图标 - 调整640以上的大小
function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-10 sm:h-7 sm:w-7"
    >
      <line x1="2" y1="6" x2="22" y2="6" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="18" x2="22" y2="18" />
    </svg>
  )
}

// 关闭图标 - 移除调试样式
function CloseMenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="white"
      className="h-14 w-14 max-sm:h-14 max-sm:w-14 sm:h-10 sm:w-10"
    >
      <path d="M18.3 5.71a.996.996 0 00-1.41 0L12 10.59 7.11 5.7A.996.996 0 105.7 7.11L10.59 12 5.7 16.89a.996.996 0 101.41 1.41L12 13.41l4.89 4.89a.996.996 0 101.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
    </svg>
  )
}

function MobileSidebar({ open, close, children }: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  return (
    <Headless.Dialog open={open} onClose={close} className="lg:hidden">
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-black/50 transition data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in z-40"
      />
      <Headless.DialogPanel
        transition
        className="fixed inset-y-0 left-0 w-full max-w-80 transition duration-300 ease-in-out data-closed:-translate-x-full z-50"
      >
        <motion.div 
          initial={{ x: -320 }}
          animate={{ x: 0 }}
          exit={{ x: -320 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="flex h-full flex-col bg-zinc-950 shadow-2xl"
        >
          {/* 关闭按钮区域 - 移除调试边框 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.674 2.075a.75.75 0 01.652 0l7.25 3.5A.75.75 0 0117 6.75v6.5a.75.75 0 01-.576 1.175l-7.25 3.5a.75.75 0 01-.648 0l-7.25-3.5A.75.75 0 013 13.25v-6.5a.75.75 0 01.576-1.175l7.25-3.5zM10 8.5L4.5 6.25v5.5L10 13.5l5.5-1.75v-5.5L10 8.5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <div className="text-base font-semibold text-white">LIMS</div>
                <div className="text-sm text-zinc-400">实验室信息系统</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <Headless.CloseButton className="group flex h-16 w-16 max-sm:h-16 max-sm:w-16 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors duration-200">
                <CloseMenuIcon />
              </Headless.CloseButton>
            </motion.div>
          </div>
          
          {/* 侧边栏内容 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="flex-1 overflow-y-auto"
          >
            {children}
          </motion.div>
        </motion.div>
      </Headless.DialogPanel>
    </Headless.Dialog>
  )
}

export function SidebarLayout({
  navbar,
  sidebar,
  children,
}: React.PropsWithChildren<{ navbar: React.ReactNode; sidebar: React.ReactNode }>) {
  let [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="relative isolate flex min-h-screen w-full bg-zinc-100 dark:bg-zinc-900">
      {/* Sidebar on desktop - 黑色背景，只在大屏幕显示 */}
      <div className="fixed inset-y-0 left-0 w-64 bg-zinc-950 shadow-2xl hidden lg:block z-30">{sidebar}</div>

      {/* Sidebar on mobile - 小于lg时显示 */}
      <MobileSidebar open={showSidebar} close={() => setShowSidebar(false)}>
        {sidebar}
      </MobileSidebar>

      {/* 主要内容区域 */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Navbar on mobile - 调整按钮大小 */}
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 lg:hidden">
          <motion.button
            onClick={() => setShowSidebar(true)}
            className="flex h-16 w-16 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:bg-zinc-100"
            aria-label="打开导航"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <HamburgerIcon />
          </motion.button>
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">{navbar}</div>
        </header>

        {/* Navbar on desktop - 大屏幕顶部导航栏 */}
        <header className="sticky top-0 z-20 hidden lg:flex items-center justify-center border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex w-full max-w-7xl items-center">{navbar}</div>
        </header>

        {/* Content - 白色背景，带圆角 */}
        <main className="flex-1 bg-white lg:m-2 lg:rounded-xl lg:shadow-sm lg:ring-1 lg:ring-zinc-950/5 dark:bg-zinc-900 dark:lg:ring-white/10 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
