import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import HomePage from '@/pages/index'

// Mock stores
const mockProjects = [
  {
    id: 1,
    lab_project_code: 'LAB-001',
    sponsor_project_code: 'SP-001',
    sponsor: { name: '药物A' },
    is_active: true,
    is_archived: false,
  },
  {
    id: 2,
    lab_project_code: 'LAB-002',
    sponsor_project_code: 'SP-002',
    sponsor: { name: '药物B' },
    is_active: true,
    is_archived: false,
  },
]

const mockTasks = {
  borrow: [
    {
      id: 1,
      title: '样本领用申请',
      category: 'borrow',
      status: 'pending',
      project_code: 'LAB-001',
      created_at: '2025-01-01T00:00:00Z',
      action_required: true,
    },
  ],
  return: [],
  transfer: [],
  destroy: [],
}

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 1, full_name: '测试用户', role: 'analyst' },
  }),
}))

vi.mock('@/store/project', () => ({
  useProjectStore: () => ({
    projects: mockProjects,
    selectedProjectId: 1,
    setSelectedProject: vi.fn(),
    fetchProjects: vi.fn(),
  }),
}))

vi.mock('@/lib/token-manager', () => ({
  tokenManager: {
    getToken: () => 'mock-token',
  },
}))

vi.mock('@/services', () => ({
  TasksService: {
    getTaskOverview: vi.fn().mockResolvedValue(mockTasks),
  },
  StatisticsService: {
    getOverviewStatistics: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/components/layouts/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}))

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('任务#3: 主页改造', () => {
    it('应该使用20%/80%布局', () => {
      render(<HomePage />)

      // 检查布局结构存在
      const layout = screen.getByTestId('app-layout')
      expect(layout).toBeInTheDocument()
    })

    it('左侧应该显示在研项目列表', () => {
      render(<HomePage />)

      // 检查"在研项目"标题
      expect(screen.getByText('在研项目')).toBeInTheDocument()

      // 检查项目列表显示项目编号
      expect(screen.getByText('LAB-001')).toBeInTheDocument()
      expect(screen.getByText('LAB-002')).toBeInTheDocument()
    })

    it('项目列表应该显示申办方/药物名称', () => {
      render(<HomePage />)

      // 检查申办方信息显示
      expect(screen.getByText('药物A')).toBeInTheDocument()
      expect(screen.getByText('药物B')).toBeInTheDocument()
    })

    it('右侧应该显示任务中心', () => {
      render(<HomePage />)

      // 检查任务中心标题
      expect(screen.getByText('任务中心')).toBeInTheDocument()
    })

    it('不应该显示工作概览模块', () => {
      render(<HomePage />)

      // 确认工作概览不存在
      expect(screen.queryByText('工作概览')).not.toBeInTheDocument()
    })

    it('不应该显示快速访问模块', () => {
      render(<HomePage />)

      // 确认快速访问不存在
      expect(screen.queryByText('快速访问')).not.toBeInTheDocument()
      expect(screen.queryByText('智能推荐')).not.toBeInTheDocument()
    })

    it('应该显示刷新按钮', () => {
      render(<HomePage />)

      expect(screen.getByText('刷新')).toBeInTheDocument()
    })
  })
})
