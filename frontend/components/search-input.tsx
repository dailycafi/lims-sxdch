import clsx from 'clsx'
import React, { forwardRef } from 'react'

export const SearchInput = forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(
  function SearchInput({ className, ...props }, ref) {
    return (
      <div className="relative">
        <input
          ref={ref}
          type="search"
          {...props}
          className={clsx(
            'w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm',
            'placeholder:text-gray-400',
            'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
            'hover:border-gray-300',
            className
          )}
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" strokeWidth={1.5} />
          <path d="M13 13L16 16" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </div>
    )
  }
)
