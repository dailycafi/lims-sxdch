import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SpecialSampleApplyPage from '@/pages/samples/special/apply'
import SpecialSampleReceivePage from '@/pages/samples/special/receive'
import SpecialSampleInventoryPage from '@/pages/samples/special/inventory'
import SpecialSampleBorrowPage from '@/pages/samples/special/borrow'
import SpecialSampleTransferPage from '@/pages/samples/special/transfer'
import SpecialSampleDestroyPage from '@/pages/samples/special/destroy'

// Mock AppLayout to simplify testing
vi.mock('@/components/layouts/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>,
}))

// Mock auth store
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    user: { id: 1, username: 'test', role: 'system_admin' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock project store
vi.mock('@/store/project', () => ({
  useProjectStore: () => ({
    projects: [],
    selectedProjectId: null,
    setSelectedProject: vi.fn(),
  }),
}))

describe('Special Sample Pages', () => {
  describe('ApplyPage', () => {
    it('renders the page with title', () => {
      render(<SpecialSampleApplyPage />)

      expect(screen.getByText('申请入库')).toBeInTheDocument()
      expect(screen.getByText(/提交特殊样本入库申请/)).toBeInTheDocument()
    })

    it('renders "新建申请" button', () => {
      render(<SpecialSampleApplyPage />)

      expect(screen.getByText('新建申请')).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<SpecialSampleApplyPage />)

      expect(screen.getByText('暂无入库申请')).toBeInTheDocument()
    })
  })

  describe('ReceivePage', () => {
    it('renders the page with title', () => {
      render(<SpecialSampleReceivePage />)

      expect(screen.getByText('样本接收')).toBeInTheDocument()
      expect(screen.getByText(/接收已审批的特殊样本/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<SpecialSampleReceivePage />)

      expect(screen.getByText('暂无待接收样本')).toBeInTheDocument()
    })
  })

  describe('InventoryPage', () => {
    it('renders the page with title', () => {
      render(<SpecialSampleInventoryPage />)

      expect(screen.getByText('清点入库')).toBeInTheDocument()
      expect(screen.getByText(/对已接收的特殊样本进行清点确认/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<SpecialSampleInventoryPage />)

      expect(screen.getByText('暂无待清点样本')).toBeInTheDocument()
    })
  })

  describe('BorrowPage', () => {
    it('renders the page with title', () => {
      render(<SpecialSampleBorrowPage />)

      expect(screen.getByText('样本存取')).toBeInTheDocument()
      expect(screen.getByText(/管理特殊样本的领用申请/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<SpecialSampleBorrowPage />)

      expect(screen.getByText('暂无存取记录')).toBeInTheDocument()
    })
  })

  describe('TransferPage', () => {
    it('renders the page with title', () => {
      render(<SpecialSampleTransferPage />)

      expect(screen.getByText('样本转移')).toBeInTheDocument()
      expect(screen.getByText(/管理特殊样本的位置转移/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<SpecialSampleTransferPage />)

      expect(screen.getByText('暂无转移记录')).toBeInTheDocument()
    })
  })

  describe('DestroyPage', () => {
    it('renders the page with title', () => {
      render(<SpecialSampleDestroyPage />)

      expect(screen.getByText('样本销毁')).toBeInTheDocument()
      expect(screen.getByText(/管理特殊样本的销毁申请/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<SpecialSampleDestroyPage />)

      expect(screen.getByText('暂无销毁记录')).toBeInTheDocument()
    })
  })
})
