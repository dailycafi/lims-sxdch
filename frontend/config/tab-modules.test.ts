import { describe, it, expect } from 'vitest'
import { TAB_MODULES, isTabEnabled, getModuleConfig } from './tab-modules'

describe('tab-modules', () => {
  describe('TAB_MODULES', () => {
    it('should have required modules configured', () => {
      const requiredModules = [
        '/tasks',
        '/projects',
        '/samples',
        '/samples/inventory',
        '/storage',
        '/statistics',
        '/settings',
      ]

      requiredModules.forEach((module) => {
        expect(TAB_MODULES[module]).toBeDefined()
        expect(TAB_MODULES[module].component).toBeDefined()
        expect(TAB_MODULES[module].title).toBeDefined()
        expect(typeof TAB_MODULES[module].allowMultiple).toBe('boolean')
      })
    })

    it('should have correct allowMultiple for inventory modules', () => {
      // Inventory should allow multiple instances
      expect(TAB_MODULES['/samples/inventory'].allowMultiple).toBe(true)
      expect(TAB_MODULES['/samples/transfer'].allowMultiple).toBe(true)
      expect(TAB_MODULES['/samples/destroy'].allowMultiple).toBe(true)
    })

    it('should have correct allowMultiple for query modules', () => {
      // Query/listing modules should not allow multiple
      expect(TAB_MODULES['/samples'].allowMultiple).toBe(false)
      expect(TAB_MODULES['/tasks'].allowMultiple).toBe(false)
      expect(TAB_MODULES['/projects'].allowMultiple).toBe(false)
    })
  })

  describe('isTabEnabled', () => {
    it('should return true for registered modules', () => {
      expect(isTabEnabled('/samples')).toBe(true)
      expect(isTabEnabled('/tasks')).toBe(true)
      expect(isTabEnabled('/projects')).toBe(true)
    })

    it('should return false for unregistered paths', () => {
      expect(isTabEnabled('/login')).toBe(false)
      expect(isTabEnabled('/unknown')).toBe(false)
      expect(isTabEnabled('/')).toBe(false)
    })
  })

  describe('getModuleConfig', () => {
    it('should return config for registered module', () => {
      const config = getModuleConfig('/samples')

      expect(config).toBeDefined()
      expect(config?.title).toBe('样本查询')
      expect(config?.allowMultiple).toBe(false)
    })

    it('should return undefined for unregistered module', () => {
      const config = getModuleConfig('/unknown')

      expect(config).toBeUndefined()
    })
  })
})
