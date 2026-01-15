'use client'

import React, { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tooltip({ content, children, position = 'top', delay = 100 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()

      let x = 0
      let y = 0

      switch (position) {
        case 'top':
          x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
          y = triggerRect.top - tooltipRect.height - 6
          break
        case 'bottom':
          x = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
          y = triggerRect.bottom + 6
          break
        case 'left':
          x = triggerRect.left - tooltipRect.width - 6
          y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
          break
        case 'right':
          x = triggerRect.right + 6
          y = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
          break
      }

      // 确保 tooltip 不会超出视窗
      x = Math.max(8, Math.min(x, window.innerWidth - tooltipRect.width - 8))
      y = Math.max(8, Math.min(y, window.innerHeight - tooltipRect.height - 8))

      setCoords({ x, y })
    }
  }, [isVisible, position])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-flex"
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={clsx(
            'fixed z-50 px-2 py-1 text-xs font-medium text-white bg-zinc-800 rounded shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-100'
          )}
          style={{
            left: coords.x,
            top: coords.y,
          }}
        >
          {content}
        </div>
      )}
    </>
  )
}
