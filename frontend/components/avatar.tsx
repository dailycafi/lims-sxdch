import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'
import { TouchTarget } from './button'
import { Link } from './link'

type AvatarProps = {
  src?: string | null
  square?: boolean
  initials?: string
  alt?: string
  className?: string
}

// 使用 forwardRef 包装 Avatar 组件以支持 ref 传递
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps & React.ComponentPropsWithoutRef<'span'>>(
  function Avatar(
    {
      src = null,
      square = false,
      initials,
      alt = '',
      className,
      ...props
    },
    ref
  ) {
    return (
      <span
        ref={ref}
        data-slot="avatar"
        {...props}
        className={clsx(
          className,
          // Basic layout - 修复默认大小
          'inline-grid shrink-0 align-middle [--avatar-radius:20%] *:col-start-1 *:row-start-1',
          'outline -outline-offset-1 outline-black/10 dark:outline-white/10',
          // 默认大小设置
          !className?.includes('h-') && !className?.includes('w-') && 'h-9 w-9',
          // Border radius
          square ? 'rounded-[--avatar-radius] *:rounded-[--avatar-radius]' : 'rounded-full *:rounded-full'
        )}
      >
        {initials && (
          <svg
            className="size-full fill-current p-[5%] text-[48px] font-medium uppercase select-none"
            viewBox="0 0 100 100"
            aria-hidden={alt ? undefined : 'true'}
          >
            {alt && <title>{alt}</title>}
            <text x="50%" y="50%" alignmentBaseline="middle" dominantBaseline="middle" textAnchor="middle" dy=".125em">
              {initials}
            </text>
          </svg>
        )}
        {src && <img className="size-full object-cover" src={src} alt={alt} />}
      </span>
    )
  }
)

export const AvatarButton = forwardRef<
  HTMLElement,
  AvatarProps &
    (Omit<Headless.ButtonProps, 'as' | 'className'> | Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
>(function AvatarButton(
  {
    src,
    square = false,
    initials,
    alt,
    className,
    ...props
  },
  ref
) {
  let classes = clsx(
    className,
    square ? 'rounded-[20%]' : 'rounded-full',
    'relative inline-grid focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
    // 默认大小设置
    !className?.includes('h-') && !className?.includes('w-') && 'h-9 w-9'
  )

  return 'href' in props ? (
    <Link {...props} className={classes} ref={ref as React.ForwardedRef<HTMLAnchorElement>}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} className="h-full w-full" />
      </TouchTarget>
    </Link>
  ) : (
    <Headless.Button {...props} className={classes} ref={ref}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} className="h-full w-full" />
      </TouchTarget>
    </Headless.Button>
  )
})
