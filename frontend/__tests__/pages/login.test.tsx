import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoginPage from '@/pages/login'

// Mock dependencies
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  backendStatusAPI: {
    checkStatus: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('@/components/force-password-change-dialog', () => ({
  ForcePasswordChangeDialog: () => null,
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('任务#3: 登录页改造', () => {
    it('应该在左上角显示软件logo和名称', () => {
      render(<LoginPage />)

      // 检查LIMS名称存在
      expect(screen.getByText('LIMS')).toBeInTheDocument()
      expect(screen.getByText('样本管理系统')).toBeInTheDocument()
    })

    it('不应该显示医院名称', () => {
      render(<LoginPage />)

      // 确认没有医院名称
      expect(screen.queryByText('徐汇区中心医院')).not.toBeInTheDocument()
    })

    it('应该显示欢迎登录标题', () => {
      render(<LoginPage />)

      expect(screen.getByText('欢迎登录')).toBeInTheDocument()
      expect(screen.getByText('请输入您的账号和密码')).toBeInTheDocument()
    })

    it('底部版权应该显示LIMS而非医院名称', () => {
      render(<LoginPage />)

      expect(screen.getByText(/© 2025 LIMS 样本管理系统/)).toBeInTheDocument()
    })

    it('应该包含用户名和密码输入框', () => {
      render(<LoginPage />)

      expect(screen.getByLabelText('用户名')).toBeInTheDocument()
      expect(screen.getByLabelText('密码')).toBeInTheDocument()
    })

    it('应该包含登录按钮', () => {
      render(<LoginPage />)

      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
    })

    it('应该显示安全登录提示', () => {
      render(<LoginPage />)

      expect(screen.getByText('安全登录')).toBeInTheDocument()
    })
  })
})
