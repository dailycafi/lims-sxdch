import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TaskCenterPanel } from '@/components/homepage/TaskCenterPanel'

// Mock services
vi.mock('@/services', () => ({
  TasksService: {
    getTaskOverview: vi.fn().mockResolvedValue({
      borrow: [
        {
          id: 1,
          title: '领用申请 #1',
          category: 'borrow',
          status: 'pending',
          action_required: true,
          project_code: 'LAB-001',
          sponsor_project_code: 'SPONSOR-001',
          sample_count: 5,
          created_at: '2024-01-15T10:00:00Z',
          project_id: 1,
        },
      ],
      return: [
        {
          id: 2,
          title: '归还申请 #2',
          category: 'return',
          status: 'approved',
          action_required: false,
          project_code: 'LAB-002',
          sample_count: 3,
          created_at: '2024-01-14T10:00:00Z',
          project_id: 2,
        },
      ],
      transfer: [],
      destroy: [],
    }),
  },
}))

// Mock project store
vi.mock('@/store/project', () => ({
  useProjectStore: () => ({
    projects: [
      { id: 1, lab_project_code: 'LAB-001' },
      { id: 2, lab_project_code: 'LAB-002' },
    ],
    selectedProjectId: null,
    setSelectedProject: vi.fn(),
  }),
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe('TaskCenterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the header with title', async () => {
    render(<TaskCenterPanel />)

    expect(screen.getByText('任务中心')).toBeInTheDocument()
    expect(screen.getByText(/查看样本相关任务/)).toBeInTheDocument()
  })

  it('renders tab navigation', async () => {
    render(<TaskCenterPanel />)

    expect(screen.getByText('全部任务')).toBeInTheDocument()
    expect(screen.getByText('申请领用')).toBeInTheDocument()
    expect(screen.getByText('样本归还')).toBeInTheDocument()
    expect(screen.getByText('样本转移')).toBeInTheDocument()
    expect(screen.getByText('样本销毁')).toBeInTheDocument()
  })

  it('renders refresh button', async () => {
    render(<TaskCenterPanel />)

    expect(screen.getByText('刷新')).toBeInTheDocument()
  })

  it('displays tasks after loading', async () => {
    render(<TaskCenterPanel />)

    await waitFor(() => {
      expect(screen.getByText('领用申请 #1')).toBeInTheDocument()
      expect(screen.getByText('归还申请 #2')).toBeInTheDocument()
    })
  })

  it('displays project codes', async () => {
    render(<TaskCenterPanel />)

    await waitFor(() => {
      expect(screen.getByText('LAB-001')).toBeInTheDocument()
      expect(screen.getByText('LAB-002')).toBeInTheDocument()
    })
  })

  it('displays action_required badge for urgent tasks', async () => {
    render(<TaskCenterPanel />)

    await waitFor(() => {
      expect(screen.getByText('需处理')).toBeInTheDocument()
    })
  })

  it('displays sample count', async () => {
    render(<TaskCenterPanel />)

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('renders table headers', async () => {
    render(<TaskCenterPanel />)

    expect(screen.getByText('任务')).toBeInTheDocument()
    expect(screen.getByText('项目')).toBeInTheDocument()
    expect(screen.getByText('状态')).toBeInTheDocument()
    expect(screen.getByText('数量')).toBeInTheDocument()
    expect(screen.getByText('创建时间')).toBeInTheDocument()
    expect(screen.getByText('操作')).toBeInTheDocument()
  })
})
