import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabState } from './useTabState'
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
  },
}))

describe('useTabState', () => {
  const mockTabId = 'test-tab-123'
  const initialState = { filter: '', page: 1 }

  beforeEach(() => {
    // Reset the store and create a tab
    act(() => {
      useTabsStore.setState({
        tabs: [
          {
            id: mockTabId,
            moduleKey: '/samples',
            title: '样本查询',
            isDirty: false,
            createdAt: Date.now(),
          },
        ],
        activeTabId: mockTabId,
      })
    })
    localStorage.clear()
  })

  it('should return initial state when tab has no state', () => {
    const { result } = renderHook(() => useTabState(mockTabId, initialState))

    expect(result.current.state).toEqual(initialState)
    expect(result.current.isDirty).toBe(false)
  })

  it('should update state and mark as dirty', () => {
    const { result } = renderHook(() => useTabState(mockTabId, initialState))

    act(() => {
      result.current.setState({ filter: 'active' })
    })

    expect(result.current.state.filter).toBe('active')
    expect(result.current.state.page).toBe(1) // Unchanged
    expect(result.current.isDirty).toBe(true)
  })

  it('should replace entire state', () => {
    const { result } = renderHook(() => useTabState(mockTabId, initialState))

    const newState = { filter: 'inactive', page: 5 }
    act(() => {
      result.current.replaceState(newState)
    })

    expect(result.current.state).toEqual(newState)
    expect(result.current.isDirty).toBe(true)
  })

  it('should mark as clean', () => {
    const { result } = renderHook(() => useTabState(mockTabId, initialState))

    act(() => {
      result.current.setState({ filter: 'active' })
    })

    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.markClean()
    })

    expect(result.current.isDirty).toBe(false)
  })

  it('should mark as dirty manually', () => {
    const { result } = renderHook(() => useTabState(mockTabId, initialState))

    expect(result.current.isDirty).toBe(false)

    act(() => {
      result.current.markDirty()
    })

    expect(result.current.isDirty).toBe(true)
  })

  it('should reset to initial state', () => {
    const { result } = renderHook(() => useTabState(mockTabId, initialState))

    act(() => {
      result.current.setState({ filter: 'active', page: 10 })
    })

    act(() => {
      result.current.resetState()
    })

    expect(result.current.state).toEqual(initialState)
    expect(result.current.isDirty).toBe(false)
  })

  it('should preserve state across re-renders', () => {
    const { result, rerender } = renderHook(() =>
      useTabState(mockTabId, initialState)
    )

    act(() => {
      result.current.setState({ filter: 'test' })
    })

    rerender()

    expect(result.current.state.filter).toBe('test')
  })
})
