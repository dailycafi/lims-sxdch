import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppLayout } from '@/components/layouts/AppLayout'

// Mock all required dependencies
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1, full_name: '测试用户', role: 'analyst' },
    logout: vi.fn(),
  }),
}))

vi.mock('@/store/project', () => ({
  useProjectStore: () => ({
    projects: [],
    selectedProjectId: null,
  }),
}))

vi.mock('@/lib/token-manager', () => ({
  tokenManager: {
    getToken: () => 'mock-token',
  },
}))

vi.mock('@/services/tasks.service', () => ({
  TasksService: {
    getTaskOverview: vi.fn().mockResolvedValue({
      borrow: [],
      return: [],
      transfer: [],
      destroy: [],
    }),
  },
}))

vi.mock('@/services/settings.service', () => ({
  SettingsService: {
    getSetting: vi.fn().mockResolvedValue({ value: 30 }),
  },
}))

vi.mock('@/components/sidebar-layout', () => ({
  SidebarLayout: ({ navbar, children }: { navbar: React.ReactNode; children: React.ReactNode }) => (
    <div data-testid="sidebar-layout">
      <nav data-testid="navbar">{navbar}</nav>
      <main>{children}</main>
    </div>
  ),
}))

vi.mock('@/components/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarSpacer: () => <div />,
  SidebarLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarToggle: () => <button>Toggle</button>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({ isCollapsed: false }),
}))

vi.mock('@/components/project-switcher', () => ({
  ProjectSwitcher: () => <div data-testid="project-switcher">Project Switcher</div>,
}))

vi.mock('@/components/breadcrumb', () => ({
  Breadcrumb: () => <div>Breadcrumb</div>,
}))

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('任务#3: 全局页面调整', () => {
    it('navbar不应该显示医院logo和名称', () => {
      render(
        <AppLayout>
          <div>Test Content</div>
        </AppLayout>
      )

      const navbar = screen.getByTestId('navbar')

      // 确认navbar中没有医院名称
      expect(within(navbar).queryByText('徐汇区中心医院')).not.toBeInTheDocument()

      // 确认navbar中没有"样本管理系统"文本（之前是医院下面的副标题）
      expect(within(navbar).queryByText('样本管理系统')).not.toBeInTheDocument()
    })

    it('应该渲染children内容', () => {
      render(
        <AppLayout>
          <div data-testid="test-content">Test Content</div>
        </AppLayout>
      )

      expect(screen.getByTestId('test-content')).toBeInTheDocument()
    })

    it('非主页应该显示项目选择器', () => {
      // 修改router mock为非主页
      vi.doMock('next/router', () => ({
        useRouter: () => ({
          push: vi.fn(),
          pathname: '/tasks',
          query: {},
          asPath: '/tasks',
        }),
      }))

      render(
        <AppLayout>
          <div>Test</div>
        </AppLayout>
      )

      // 项目选择器应该存在
      expect(screen.getByTestId('project-switcher')).toBeInTheDocument()
    })
  })
})

// Helper function for within queries
function within(element: HTMLElement) {
  return {
    queryByText: (text: string) => {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      )
      let node
      while ((node = walker.nextNode())) {
        if (node.textContent?.includes(text)) {
          return node.parentElement
        }
      }
      return null
    },
  }
}
