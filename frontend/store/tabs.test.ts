import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useTabsStore } from './tabs'

// Mock tab-modules to avoid import issues
vi.mock('@/config/tab-modules', () => ({
  TAB_MODULES: {
    '/samples': {
      component: () => null,
      title: '样本查询',
      icon: 'MagnifyingGlassIcon',
      allowMultiple: false,
    },
    '/samples/inventory': {
      component: () => null,
      title: '清点入库',
      icon: 'ClipboardDocumentListIcon',
      allowMultiple: true,
    },
    '/tasks': {
      component: () => null,
      title: '任务中心',
      icon: 'ClipboardDocumentCheckIcon',
      allowMultiple: false,
    },
  },
}))

describe('useTabsStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    const store = useTabsStore.getState()
    act(() => {
      useTabsStore.setState({ tabs: [], activeTabId: null })
    })
    // Clear localStorage
    localStorage.clear()
  })

  describe('openTab', () => {
    it('should open a new tab', () => {
      const { openTab } = useTabsStore.getState()

      act(() => {
        openTab('/samples')
      })

      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
      expect(tabs[0].moduleKey).toBe('/samples')
      expect(tabs[0].title).toBe('样本查询')
      expect(activeTabId).toBe(tabs[0].id)
    })

    it('should return empty string for unknown module', () => {
      const { openTab } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/unknown')
      })

      expect(tabId).toBe('')
      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(0)
    })

    it('should switch to existing tab when allowMultiple is false', () => {
      const { openTab } = useTabsStore.getState()

      let firstTabId: string = ''
      let secondTabId: string = ''

      act(() => {
        firstTabId = openTab('/samples')
      })

      act(() => {
        secondTabId = openTab('/samples')
      })

      expect(firstTabId).toBe(secondTabId)
      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
    })

    it('should create new tab when allowMultiple is true', () => {
      const { openTab } = useTabsStore.getState()

      let firstTabId: string = ''
      let secondTabId: string = ''

      act(() => {
        firstTabId = openTab('/samples/inventory')
      })

      act(() => {
        secondTabId = openTab('/samples/inventory')
      })

      expect(firstTabId).not.toBe(secondTabId)
      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(2)
    })

    it('should use custom title when provided', () => {
      const { openTab } = useTabsStore.getState()

      act(() => {
        openTab('/samples', { title: '自定义标题' })
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs[0].title).toBe('自定义标题')
    })

    it('should store params when provided', () => {
      const { openTab } = useTabsStore.getState()
      const params = { filter: 'active', page: 1 }

      act(() => {
        openTab('/samples', { params })
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs[0].params).toEqual(params)
    })

    it('should force new tab when forceNew is true', () => {
      const { openTab } = useTabsStore.getState()

      act(() => {
        openTab('/samples')
      })

      act(() => {
        openTab('/samples', { forceNew: true })
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(2)
    })
  })

  describe('closeTab', () => {
    it('should close a tab', () => {
      const { openTab, closeTab } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
      })

      let result: boolean = false
      act(() => {
        result = closeTab(tabId)
      })

      expect(result).toBe(true)
      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(0)
    })

    it('should not close tab with dirty state without force', () => {
      const { openTab, closeTab, setTabDirty } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
      })

      act(() => {
        setTabDirty(tabId, true)
      })

      let result: boolean = true
      act(() => {
        result = closeTab(tabId)
      })

      expect(result).toBe(false)
      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
    })

    it('should close dirty tab when force is true', () => {
      const { openTab, closeTab, setTabDirty } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
      })

      act(() => {
        setTabDirty(tabId, true)
      })

      let result: boolean = false
      act(() => {
        result = closeTab(tabId, true)
      })

      expect(result).toBe(true)
      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(0)
    })

    it('should activate next tab when closing active tab', () => {
      const { openTab, closeTab } = useTabsStore.getState()

      let tab1Id: string = ''
      let tab2Id: string = ''

      act(() => {
        tab1Id = openTab('/samples')
        tab2Id = openTab('/tasks')
      })

      // tab2 is now active
      act(() => {
        closeTab(tab2Id)
      })

      const { activeTabId } = useTabsStore.getState()
      expect(activeTabId).toBe(tab1Id)
    })
  })

  describe('switchTab', () => {
    it('should switch to specified tab', () => {
      const { openTab, switchTab } = useTabsStore.getState()

      let tab1Id: string = ''
      let tab2Id: string = ''

      act(() => {
        tab1Id = openTab('/samples')
        tab2Id = openTab('/tasks')
      })

      act(() => {
        switchTab(tab1Id)
      })

      const { activeTabId } = useTabsStore.getState()
      expect(activeTabId).toBe(tab1Id)
    })
  })

  describe('updateTabState', () => {
    it('should update tab state', () => {
      const { openTab, updateTabState } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
      })

      const newState = { filter: 'active', page: 2 }
      act(() => {
        updateTabState(tabId, { state: newState })
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs[0].state).toEqual(newState)
    })

    it('should update tab title', () => {
      const { openTab, updateTabState } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
      })

      act(() => {
        updateTabState(tabId, { title: '新标题' })
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs[0].title).toBe('新标题')
    })
  })

  describe('setTabDirty', () => {
    it('should set tab dirty state', () => {
      const { openTab, setTabDirty } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
      })

      act(() => {
        setTabDirty(tabId, true)
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs[0].isDirty).toBe(true)
    })
  })

  describe('saveScrollPosition', () => {
    it('should save scroll position', () => {
      const { openTab, saveScrollPosition } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
      })

      act(() => {
        saveScrollPosition(tabId, 500)
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs[0].scrollPosition).toBe(500)
    })
  })

  describe('closeOtherTabs', () => {
    it('should close other tabs without dirty state', () => {
      const { openTab, closeOtherTabs } = useTabsStore.getState()

      let tab1Id: string = ''
      act(() => {
        tab1Id = openTab('/samples')
        openTab('/tasks')
        openTab('/samples/inventory')
      })

      act(() => {
        closeOtherTabs(tab1Id)
      })

      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
      expect(tabs[0].id).toBe(tab1Id)
      expect(activeTabId).toBe(tab1Id)
    })

    it('should keep dirty tabs when closing others', () => {
      const { openTab, closeOtherTabs, setTabDirty } = useTabsStore.getState()

      let tab1Id: string = ''
      let tab2Id: string = ''
      act(() => {
        tab1Id = openTab('/samples')
        tab2Id = openTab('/tasks')
        openTab('/samples/inventory')
      })

      act(() => {
        setTabDirty(tab2Id, true)
      })

      act(() => {
        closeOtherTabs(tab1Id)
      })

      const { tabs } = useTabsStore.getState()
      expect(tabs).toHaveLength(2)
      expect(tabs.some((t) => t.id === tab1Id)).toBe(true)
      expect(tabs.some((t) => t.id === tab2Id)).toBe(true)
    })
  })

  describe('closeAllTabs', () => {
    it('should close all tabs without dirty state', () => {
      const { openTab, closeAllTabs } = useTabsStore.getState()

      act(() => {
        openTab('/samples')
        openTab('/tasks')
      })

      act(() => {
        closeAllTabs()
      })

      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs).toHaveLength(0)
      expect(activeTabId).toBeNull()
    })

    it('should keep dirty tabs', () => {
      const { openTab, closeAllTabs, setTabDirty } = useTabsStore.getState()

      let dirtyTabId: string = ''
      act(() => {
        dirtyTabId = openTab('/samples')
        openTab('/tasks')
      })

      act(() => {
        setTabDirty(dirtyTabId, true)
      })

      act(() => {
        closeAllTabs()
      })

      const { tabs, activeTabId } = useTabsStore.getState()
      expect(tabs).toHaveLength(1)
      expect(tabs[0].id).toBe(dirtyTabId)
      expect(activeTabId).toBe(dirtyTabId)
    })
  })

  describe('getDirtyTabsCount', () => {
    it('should return count of dirty tabs', () => {
      const { openTab, setTabDirty, getDirtyTabsCount } = useTabsStore.getState()

      act(() => {
        const tab1 = openTab('/samples')
        openTab('/tasks')
        const tab3 = openTab('/samples/inventory')
        setTabDirty(tab1, true)
        setTabDirty(tab3, true)
      })

      const count = getDirtyTabsCount()
      expect(count).toBe(2)
    })
  })

  describe('findTabByModuleKey', () => {
    it('should find tab by module key', () => {
      const { openTab, findTabByModuleKey } = useTabsStore.getState()

      let tabId: string = ''
      act(() => {
        tabId = openTab('/samples')
        openTab('/tasks')
      })

      const tab = findTabByModuleKey('/samples')
      expect(tab?.id).toBe(tabId)
    })

    it('should return undefined for non-existing module', () => {
      const { openTab, findTabByModuleKey } = useTabsStore.getState()

      act(() => {
        openTab('/samples')
      })

      const tab = findTabByModuleKey('/unknown')
      expect(tab).toBeUndefined()
    })
  })
})
