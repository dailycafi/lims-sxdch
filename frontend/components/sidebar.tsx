'use client'

import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import { LayoutGroup, motion } from 'framer-motion'
import React, { forwardRef, useId, createContext, useContext, useState, useCallback } from 'react'
import { TouchTarget } from './button'
import { Link } from './link'
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/20/solid'

// Sidebar Context
type SidebarContextValue = {
  isCollapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    // Return a default context for components rendered outside the provider
    // This prevents crashes but functionality will be limited (always expanded)
    return { isCollapsed: false, toggle: () => {} }
  }
  return context
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const toggle = useCallback(() => setIsCollapsed(prev => !prev), [])

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function Sidebar({ className, ...props }: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav {...props} className={clsx(className, 'flex h-full min-h-0 flex-col bg-zinc-950')} />
}

export function SidebarHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-col border-b border-zinc-800 p-4 [&>[data-slot=section]+[data-slot=section]]:mt-2.5'
      )}
    />
  )
}

export function SidebarBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-1 flex-col overflow-y-auto p-4 [&>[data-slot=section]+[data-slot=section]]:mt-8'
      )}
    />
  )
}

export function SidebarFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-col border-t border-zinc-800 p-4 [&>[data-slot=section]+[data-slot=section]]:mt-2.5'
      )}
    />
  )
}

export function SidebarSection({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  let id = useId()

  return (
    <LayoutGroup id={id}>
      <div {...props} data-slot="section" className={clsx(className, 'flex flex-col gap-0.5')} />
    </LayoutGroup>
  )
}

export function SidebarDivider({ className, ...props }: React.ComponentPropsWithoutRef<'hr'>) {
  return <hr {...props} className={clsx(className, 'my-4 border-t border-zinc-800 lg:-mx-4')} />
}

export function SidebarSpacer({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div aria-hidden="true" {...props} className={clsx(className, 'mt-8 flex-1')} />
}

export function SidebarHeading({ className, ...props }: React.ComponentPropsWithoutRef<'h3'>) {
  const { isCollapsed } = useSidebar()
  return (
    <motion.h3 
      {...props} 
      initial={false}
      animate={{ 
        opacity: isCollapsed ? 0 : 1,
        height: isCollapsed ? 0 : "auto",
        marginBottom: isCollapsed ? 0 : 4
      }}
      transition={{ duration: 0.2 }}
      className={clsx(className, 'mb-1 px-2 text-xs/6 font-medium text-zinc-400 overflow-hidden whitespace-nowrap')} 
    />
  )
}

export function SidebarContent({ className, children, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const { isCollapsed } = useSidebar()
  return (
    <motion.div 
      {...props} 
      initial={false}
      animate={{ 
        opacity: isCollapsed ? 0 : 1,
        width: isCollapsed ? 0 : "auto",
        display: isCollapsed ? "none" : "block"
      }}
      transition={{ duration: 0.2 }}
      className={clsx(className, 'overflow-hidden whitespace-nowrap')}
    >
      {children}
    </motion.div>
  )
}

export const SidebarItem = forwardRef(function SidebarItem(
  {
    current,
    className,
    children,
    ...props
  }: { current?: boolean; className?: string; children: React.ReactNode } & (
    | Omit<Headless.ButtonProps, 'as' | 'className'>
    | Omit<Headless.ButtonProps<typeof Link>, 'as' | 'className'>
  ),
  ref: React.ForwardedRef<HTMLAnchorElement | HTMLButtonElement>
) {
  const { isCollapsed } = useSidebar()
  let classes = clsx(
    // Base
    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-base/6 font-medium text-zinc-300 transition-all duration-200 sm:text-sm/5',
    isCollapsed && 'lg:justify-center lg:px-2',
    // Leading icon/icon-only
    '*:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-400',
    // Trailing icon (down chevron or similar)
    '*:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4',
    isCollapsed && 'lg:*:last:data-[slot=icon]:hidden',
    // Avatar
    '*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6',
    // Hover
    'hover:bg-zinc-800/50 hover:text-white hover:*:data-[slot=icon]:fill-zinc-100',
    // Active
    'data-active:bg-zinc-800/70 data-active:text-white data-active:*:data-[slot=icon]:fill-white',
    // Current
    'data-current:bg-zinc-800 data-current:text-white data-current:shadow-sm data-current:*:data-[slot=icon]:fill-white'
  )

  return (
    <span className={clsx(className, 'relative')}>
      {current && (
        <motion.span
          layoutId="current-indicator"
          className="absolute inset-y-1 -left-4 w-1 rounded-r-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        />
      )}
      {'href' in props ? (
        <Headless.CloseButton
          as={Link}
          {...props}
          className={classes}
          data-current={current ? 'true' : undefined}
          ref={ref}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.CloseButton>
      ) : (
        <Headless.Button
          {...props}
          className={clsx('cursor-default', classes)}
          data-current={current ? 'true' : undefined}
          ref={ref}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.Button>
      )}
    </span>
  )
})

export function SidebarLabel({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  const { isCollapsed } = useSidebar()
  return (
    <motion.span 
      {...props} 
      initial={false}
      animate={{ 
        opacity: isCollapsed ? 0 : 1,
        width: isCollapsed ? 0 : "auto",
        display: isCollapsed ? "none" : "block"
      }}
      transition={{ duration: 0.2 }}
      className={clsx(className, 'truncate')} 
    />
  )
}

export function SidebarToggle({ className, onClick }: { className?: string, onClick?: () => void }) {
  const { isCollapsed, toggle } = useSidebar()
  
  return (
    <button 
      type="button"
      onClick={onClick || toggle}
      className={clsx(
        className, 
        "flex items-center justify-center p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-md transition-all duration-200 focus:outline-none group"
      )}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {isCollapsed ? (
        <ChevronDoubleRightIcon className="size-5 transition-transform duration-200 group-hover:text-white" />
      ) : (
        <ChevronDoubleLeftIcon className="size-5 transition-transform duration-200 group-hover:text-white" />
      )}
    </button>
  )
}
