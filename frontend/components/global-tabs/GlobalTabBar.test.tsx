import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import { GlobalTabBar } from './GlobalTabBar'
import { useTabsStore } from '@/store/tabs'

// Mock tab-modules
vi.mock('@/config/tab-modules', () => ({
  TAB_MODULES: {
    '/samples': {
      component: () => null,
      title: '样本查询',
      icon: 'MagnifyingGlassIcon',
      allowMultiple: false,
    },
    '/tasks': {
      component: () => null,
      title: '任务中心',
      icon: 'ClipboardDocumentCheckIcon',
      allowMultiple: false,
    },
  },
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('GlobalTabBar', () => {
  beforeEach(() => {
    act(() => {
      useTabsStore.setState({ tabs: [], activeTabId: null })
    })
    localStorage.clear()
  })

  it('should not render when no tabs', () => {
    const { container } = render(<GlobalTabBar />)
    expect(container.firstChild).toBeNull()
  })

  it('should render tabs', () => {
    act(() => {
      useTabsStore.setState({
        tabs: [
          {
            id: 'tab-1',
            moduleKey: '/samples',
            title: '样本查询',
            isDirty: false,
            createdAt: Date.now(),
          },
          {
            id: 'tab-2',
            moduleKey: '/tasks',
            title: '任务中心',
            isDirty: false,
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      })
    })

    render(<GlobalTabBar />)

    expect(screen.getByText('样本查询')).toBeInTheDocument()
    expect(screen.getByText('任务中心')).toBeInTheDocument()
  })

  it('should switch tab on click', () => {
    act(() => {
      useTabsStore.setState({
        tabs: [
          {
            id: 'tab-1',
            moduleKey: '/samples',
            title: '样本查询',
            isDirty: false,
            createdAt: Date.now(),
          },
          {
            id: 'tab-2',
            moduleKey: '/tasks',
            title: '任务中心',
            isDirty: false,
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      })
    })

    render(<GlobalTabBar />)

    // Click on the second tab
    fireEvent.click(screen.getByText('任务中心'))

    const { activeTabId } = useTabsStore.getState()
    expect(activeTabId).toBe('tab-2')
  })

  it('should show dirty indicator for dirty tabs', () => {
    act(() => {
      useTabsStore.setState({
        tabs: [
          {
            id: 'tab-1',
            moduleKey: '/samples',
            title: '样本查询',
            isDirty: true,
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      })
    })

    render(<GlobalTabBar />)

    // Check for dirty indicator (a span with specific title)
    expect(screen.getByTitle('有未保存的更改')).toBeInTheDocument()
  })

  it('should close tab when clicking close button', () => {
    act(() => {
      useTabsStore.setState({
        tabs: [
          {
            id: 'tab-1',
            moduleKey: '/samples',
            title: '样本查询',
            isDirty: false,
            createdAt: Date.now(),
          },
        ],
        activeTabId: 'tab-1',
      })
    })

    render(<GlobalTabBar />)

    // Find and click the close button (X icon button)
    const closeButtons = screen.getAllByRole('button')
    // The close button is in the TabItem
    const closeButton = closeButtons.find((btn) =>
      btn.querySelector('svg')
    )

    if (closeButton) {
      fireEvent.click(closeButton)
    }

    const { tabs } = useTabsStore.getState()
    expect(tabs).toHaveLength(0)
  })
})
