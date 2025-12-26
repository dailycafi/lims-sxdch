import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import type React from 'react'
import { Text } from './text'

const sizes = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
  '6xl': 'sm:max-w-6xl',
  '7xl': 'sm:max-w-7xl',
  'full': 'sm:max-w-full',
}

export function Dialog({
  size = 'lg',
  className,
  children,
  onClose,
  disableOutsideClick = true, // 默认禁用外部点击关闭，防止误触导致数据丢失
  ...props
}: { size?: keyof typeof sizes; className?: string; children: React.ReactNode; disableOutsideClick?: boolean } & Headless.DialogProps) {
  return (
    <Headless.Dialog 
      {...props} 
      onClose={(val) => {
        if (disableOutsideClick) return;
        onClose(val);
      }}
    >
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 flex w-screen justify-center overflow-y-auto bg-zinc-950/30 backdrop-blur-sm px-2 py-2 transition duration-200 focus:outline-0 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:px-6 sm:py-8 lg:px-8 lg:py-16 dark:bg-zinc-950/60"
      />

      <div className="fixed inset-0 w-screen overflow-y-auto pt-6 sm:pt-0">
        <div className="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <Headless.DialogPanel
            transition
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              className,
              sizes[size],
              'relative row-start-2 w-full min-w-0 rounded-t-3xl bg-white p-6 shadow-2xl ring-1 ring-zinc-950/10 sm:p-8 sm:mb-auto sm:rounded-2xl dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline overflow-hidden',
              'transition duration-300 ease-out will-change-transform data-closed:translate-y-12 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 sm:data-closed:translate-y-0 sm:data-closed:scale-95'
            )}
          >
            {/* 科技感背景纹理 - 非常淡的网格 */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
              backgroundImage: `
                linear-gradient(rgb(37, 99, 235) 1px, transparent 1px),
                linear-gradient(90deg, rgb(37, 99, 235) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px'
            }} />
            
            {/* 侧边渐变装饰 */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-600/60 via-indigo-500/40 to-transparent" />
            
            <div className="relative z-10">
              {children}
            </div>
          </Headless.DialogPanel>
        </div>
      </div>
    </Headless.Dialog>
  )
}

export function DialogTitle({
  className,
  ...props
}: { className?: string } & Omit<Headless.DialogTitleProps, 'as' | 'className'>) {
  return (
    <Headless.DialogTitle
      {...props}
      className={clsx(className, 'text-center text-lg/6 font-semibold text-balance text-zinc-950 sm:text-base/6 dark:text-white')}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: { className?: string } & Omit<Headless.DescriptionProps<typeof Text>, 'as' | 'className'>) {
  return <Headless.Description as={Text} {...props} className={clsx(className, 'mt-2 text-pretty')} />
}

export function DialogBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'mt-6')} />
}

export function DialogActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'mt-8 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:flex-row sm:*:w-auto'
      )}
    />
  )
}
