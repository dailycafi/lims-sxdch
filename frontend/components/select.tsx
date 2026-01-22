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
        // Focus ring
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset has-[[data-focus]]:after:ring-2 has-[[data-focus]]:after:ring-blue-500',
        // Disabled state
        'has-[[data-disabled]]:opacity-50',
      ])}
    >
      <Headless.Select
        ref={ref}
        multiple={multiple}
        {...props}
        className={clsx([
          // Basic layout
          'relative block w-full appearance-none rounded-lg py-2 sm:py-1.5',
          // Horizontal padding
          multiple
            ? 'px-4 sm:px-3'
            : 'pr-10 pl-4 sm:pr-9 sm:pl-3',
          // Options (multi-select)
          '[&_optgroup]:font-semibold',
          // Typography
          'text-base/6 text-zinc-950 placeholder:text-zinc-400 sm:text-sm/6 dark:text-white dark:*:text-white',
          // Border
          'border border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20',
          // Background color
          'bg-white dark:bg-zinc-800 dark:*:bg-zinc-800',
          // Shadow
          'shadow-sm hover:shadow transition-shadow duration-150',
          // Hide default focus styles
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          // Invalid state
          'data-[invalid]:border-red-500 data-[invalid]:hover:border-red-500',
          // Disabled state
          'disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
        ])}
      />
      {!multiple && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className="size-5 text-gray-400 sm:size-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </span>
      )}
    </span>
  )
})
