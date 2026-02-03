import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTabNavigation } from './useTabNavigation'
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
  isTabEnabled: (path: string) => ['/samples', '/tasks'].includes(path),
}))

describe('useTabNavigation', () => {
  beforeEach(() => {
    act(() => {
      useTabsStore.setState({ tabs: [], activeTabId: null })
    })
    localStorage.clear()
  })

  describe('navigate', () => {
    it('should open tab for tab-enabled path', () => {
      const { result } = renderHook(() => useTabNavigation())

      let tabId: string = ''
      act(() => {
        tabId = result.current.navigate('/samples')
      })

      expect(tabId).not.toBe('')
      expect(result.current.tabs).toHaveLength(1)
      expect(result.current.tabs[0].moduleKey).toBe('/samples')
    })

    it('should return empty string for non-tab-enabled path', () => {
      const { result } = renderHook(() => useTabNavigation())

      let tabId: string = 'initial'
      act(() => {
        tabId = result.current.navigate('/unknown')
      })

      expect(tabId).toBe('')
      expect(result.current.tabs).toHaveLength(0)
    })

    it('should pass options to openTab', () => {
      const { result } = renderHook(() => useTabNavigation())

      act(() => {
        result.current.navigate('/samples', {
          title: '自定义标题',
          params: { filter: 'active' },
        })
      })

      expect(result.current.tabs[0].title).toBe('自定义标题')
      expect(result.current.tabs[0].params).toEqual({ filter: 'active' })
    })
  })

  describe('openTab', () => {
    it('should be alias for navigate', () => {
      const { result } = renderHook(() => useTabNavigation())

      act(() => {
        result.current.openTab('/samples')
      })

      expect(result.current.tabs).toHaveLength(1)
    })
  })

  describe('isTabPath', () => {
    it('should return true for tab-enabled path', () => {
      const { result } = renderHook(() => useTabNavigation())

      expect(result.current.isTabPath('/samples')).toBe(true)
      expect(result.current.isTabPath('/tasks')).toBe(true)
    })

    it('should return false for non-tab-enabled path', () => {
      const { result } = renderHook(() => useTabNavigation())

      expect(result.current.isTabPath('/unknown')).toBe(false)
      expect(result.current.isTabPath('/')).toBe(false)
    })
  })

  describe('getActiveTab', () => {
    it('should return null when no tabs', () => {
      const { result } = renderHook(() => useTabNavigation())

      expect(result.current.getActiveTab()).toBeNull()
    })

    it('should return active tab', () => {
      const { result } = renderHook(() => useTabNavigation())

      act(() => {
        result.current.navigate('/samples')
      })

      const activeTab = result.current.getActiveTab()
      expect(activeTab?.moduleKey).toBe('/samples')
    })
  })

  describe('navigateToExisting', () => {
    it('should switch to existing tab', () => {
      const { result } = renderHook(() => useTabNavigation())

      let tab1Id: string = ''
      act(() => {
        tab1Id = result.current.navigate('/samples')
        result.current.navigate('/tasks')
      })

      // Currently on /tasks
      expect(result.current.activeTabId).not.toBe(tab1Id)

      let found: boolean = false
      act(() => {
        found = result.current.navigateToExisting('/samples')
      })

      expect(found).toBe(true)
      expect(result.current.activeTabId).toBe(tab1Id)
    })

    it('should return false for non-existing module', () => {
      const { result } = renderHook(() => useTabNavigation())

      act(() => {
        result.current.navigate('/samples')
      })

      let found: boolean = true
      act(() => {
        found = result.current.navigateToExisting('/unknown')
      })

      expect(found).toBe(false)
    })
  })
})
