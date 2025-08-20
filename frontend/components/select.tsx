import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'

export const Select = forwardRef(function Select(
  { className, multiple, ...props }: { className?: string } & Omit<Headless.SelectProps, 'as' | 'className'>,
  ref: React.ForwardedRef<HTMLSelectElement>
) {
  return (
    <span
      data-slot="control"
      className={clsx([
        className,
        // Basic layout
        'group relative block w-full',
        // Background color + shadow applied to inset pseudo element, so shadow blends with border in light mode
        'before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm',
        // Background color is moved to control and shadow is removed in dark mode so hide `before` pseudo
        'dark:before:hidden',
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-data-focus:after:ring-2 has-data-focus:after:ring-blue-500',
        // Disabled state
        'has-data-disabled:opacity-50 has-data-disabled:before:bg-zinc-950/5 has-data-disabled:before:shadow-none',
        // 增加阴影效果
        'shadow-sm hover:shadow-md transition-shadow duration-200',
      ])}
    >
      <Headless.Select
        ref={ref}
        multiple={multiple}
        {...props}
        className={clsx([
          // Basic layout - 增加圆角
          'relative block w-full appearance-none rounded-xl py-[calc(--spacing(2.5)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
          // Horizontal padding - 确保文字有适当的左边距
          multiple
            ? 'px-4 sm:px-3'
            : 'pr-10 pl-4 sm:pr-9 sm:pl-3',
          // Options (multi-select)
          '[&_optgroup]:font-semibold',
          // Typography
          'text-base/6 text-zinc-950 placeholder:text-zinc-400 sm:text-sm/6 dark:text-white dark:*:text-white',
          // Border - 更新边框颜色
          'border border-gray-200 data-hover:border-gray-300 dark:border-white/10 dark:data-hover:border-white/20',
          // Background color
          'bg-transparent dark:bg-white/5 dark:*:bg-zinc-800',
          // Hide default focus styles
          'focus:outline-hidden',
          // Invalid state
          'data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600',
          // Disabled state
          'data-disabled:border-zinc-950/20 data-disabled:opacity-100 dark:data-disabled:border-white/15 dark:data-disabled:bg-white/2.5 dark:data-hover:data-disabled:border-white/15',
          // 确保统一的高度
          'h-full min-h-[2.75rem]',
          // 自定义 select 样式类
          'custom-select',
        ])}
      />
      {!multiple && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className="size-5 text-gray-400 sm:size-4"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="7" strokeWidth={1.5} />
            <path d="M14 14L17 17" strokeWidth={1.5} strokeLinecap="round" />
          </svg>
        </span>
      )}
    </span>
  )
})
