import React from 'react';
import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={clsx('flex', className)} aria-label="面包屑导航">
      <ol className="flex items-center space-x-1 sm:space-x-2 text-sm overflow-x-auto">
        {/* 主页链接 */}
        <li className="flex-shrink-0">
          <Link
            href="/"
            className="flex items-center text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors p-1 rounded"
          >
            <HomeIcon className="h-4 w-4" />
            <span className="sr-only">主页</span>
          </Link>
        </li>
        
        {/* 面包屑项目 */}
        {items.map((item, index) => (
          <li key={index} className="flex items-center flex-shrink-0">
            <ChevronRightIcon className="h-3 w-3 sm:h-4 sm:w-4 text-zinc-400 dark:text-zinc-500 mx-1 sm:mx-2 flex-shrink-0" />
            {item.current || !item.href ? (
              <span className="text-zinc-900 dark:text-white font-medium text-sm truncate max-w-32 sm:max-w-none">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors text-sm truncate max-w-32 sm:max-w-none"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
