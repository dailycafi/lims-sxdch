import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MatrixSampleReceivePage from '@/pages/samples/matrix/receive'
import MatrixSampleInventoryPage from '@/pages/samples/matrix/inventory'
import MatrixSampleAliquotPage from '@/pages/samples/matrix/aliquot'
import MatrixSampleBorrowPage from '@/pages/samples/matrix/borrow'
import MatrixSampleTransferPage from '@/pages/samples/matrix/transfer'
import MatrixSampleDestroyPage from '@/pages/samples/matrix/destroy'

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

describe('Matrix Sample Pages', () => {
  describe('ReceivePage', () => {
    it('renders the page with title', () => {
      render(<MatrixSampleReceivePage />)

      expect(screen.getByText('样本接收')).toBeInTheDocument()
      expect(screen.getByText(/接收空白基质样本/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<MatrixSampleReceivePage />)

      expect(screen.getByText('暂无待接收样本')).toBeInTheDocument()
    })
  })

  describe('InventoryPage', () => {
    it('renders the page with title', () => {
      render(<MatrixSampleInventoryPage />)

      expect(screen.getByText('样本清点')).toBeInTheDocument()
      expect(screen.getByText(/对已接收的空白基质样本进行清点确认/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<MatrixSampleInventoryPage />)

      expect(screen.getByText('暂无待清点样本')).toBeInTheDocument()
    })
  })

  describe('AliquotPage', () => {
    it('renders the page with title', () => {
      render(<MatrixSampleAliquotPage />)

      expect(screen.getByText('分装入库')).toBeInTheDocument()
      expect(screen.getByText(/对空白基质样本进行分装处理/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<MatrixSampleAliquotPage />)

      expect(screen.getByText('暂无待分装样本')).toBeInTheDocument()
    })
  })

  describe('BorrowPage', () => {
    it('renders the page with title', () => {
      render(<MatrixSampleBorrowPage />)

      expect(screen.getByText('样本存取')).toBeInTheDocument()
      expect(screen.getByText(/管理空白基质样本的领用和归还/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<MatrixSampleBorrowPage />)

      expect(screen.getByText('暂无存取记录')).toBeInTheDocument()
    })
  })

  describe('TransferPage', () => {
    it('renders the page with title', () => {
      render(<MatrixSampleTransferPage />)

      expect(screen.getByText('样本转移')).toBeInTheDocument()
      expect(screen.getByText(/管理空白基质样本的位置转移/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<MatrixSampleTransferPage />)

      expect(screen.getByText('暂无转移记录')).toBeInTheDocument()
    })
  })

  describe('DestroyPage', () => {
    it('renders the page with title', () => {
      render(<MatrixSampleDestroyPage />)

      expect(screen.getByText('样本销毁')).toBeInTheDocument()
      expect(screen.getByText(/管理空白基质样本的销毁申请/)).toBeInTheDocument()
    })

    it('shows empty state message', () => {
      render(<MatrixSampleDestroyPage />)

      expect(screen.getByText('暂无销毁记录')).toBeInTheDocument()
    })
  })
})
