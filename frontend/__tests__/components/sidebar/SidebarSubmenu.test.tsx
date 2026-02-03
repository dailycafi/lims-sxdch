import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarSubmenu, SidebarSubmenuItem, SidebarProvider } from '@/components/sidebar'
import { FolderIcon } from '@heroicons/react/20/solid'

// Wrapper component with SidebarProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>
}

describe('SidebarSubmenu', () => {
  it('renders with label and icon', () => {
    render(
      <TestWrapper>
        <SidebarSubmenu label="项目管理" icon={FolderIcon}>
          <SidebarSubmenuItem href="/projects">项目列表</SidebarSubmenuItem>
        </SidebarSubmenu>
      </TestWrapper>
    )

    expect(screen.getByText('项目管理')).toBeInTheDocument()
  })

  it('toggles open/close on click', () => {
    render(
      <TestWrapper>
        <SidebarSubmenu label="项目管理" icon={FolderIcon}>
          <SidebarSubmenuItem href="/projects">项目列表</SidebarSubmenuItem>
        </SidebarSubmenu>
      </TestWrapper>
    )

    const button = screen.getByRole('button')

    // Initially closed (defaultOpen = false)
    fireEvent.click(button)

    // After click, should show submenu item
    expect(screen.getByText('项目列表')).toBeInTheDocument()
  })

  it('renders with defaultOpen=true', () => {
    render(
      <TestWrapper>
        <SidebarSubmenu label="项目管理" icon={FolderIcon} defaultOpen>
          <SidebarSubmenuItem href="/projects">项目列表</SidebarSubmenuItem>
        </SidebarSubmenu>
      </TestWrapper>
    )

    expect(screen.getByText('项目列表')).toBeInTheDocument()
  })

  it('renders multiple submenu items', () => {
    render(
      <TestWrapper>
        <SidebarSubmenu label="项目管理" icon={FolderIcon} defaultOpen>
          <SidebarSubmenuItem href="/projects/new">新建项目</SidebarSubmenuItem>
          <SidebarSubmenuItem href="/projects">项目配置</SidebarSubmenuItem>
          <SidebarSubmenuItem href="/archive">项目归档</SidebarSubmenuItem>
        </SidebarSubmenu>
      </TestWrapper>
    )

    expect(screen.getByText('新建项目')).toBeInTheDocument()
    expect(screen.getByText('项目配置')).toBeInTheDocument()
    expect(screen.getByText('项目归档')).toBeInTheDocument()
  })
})

describe('SidebarSubmenuItem', () => {
  it('renders as a link when href is provided', () => {
    render(
      <TestWrapper>
        <SidebarSubmenuItem href="/projects">项目列表</SidebarSubmenuItem>
      </TestWrapper>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/projects')
  })

  it('renders with current prop', () => {
    render(
      <TestWrapper>
        <SidebarSubmenuItem href="/projects" current>
          项目列表
        </SidebarSubmenuItem>
      </TestWrapper>
    )

    const link = screen.getByRole('link')
    // The link should be rendered with href
    expect(link).toHaveAttribute('href', '/projects')
    expect(link).toHaveTextContent('项目列表')
  })
})
