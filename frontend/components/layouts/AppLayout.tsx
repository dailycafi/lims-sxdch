import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { Image } from '@/components/image';
import { useAuthStore } from '@/store/auth';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Breadcrumb, BreadcrumbItem } from '@/components/breadcrumb';
import { 
  Sidebar, 
  SidebarBody, 
  SidebarHeader, 
  SidebarSection, 
  SidebarItem,
  SidebarHeading,
  SidebarSpacer,
  SidebarLabel,
  SidebarFooter
} from '@/components/sidebar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem } from '@/components/dropdown';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import {
  HomeIcon,
  BeakerIcon,
  FolderIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  ArrowUpOnSquareIcon,
  ArrowsRightLeftIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/20/solid';

interface AppLayoutProps {
  children: ReactNode;
}

// 路由到面包屑的映射
const routeToBreadcrumb: Record<string, BreadcrumbItem[]> = {
  '/': [],
  '/samples/receive': [
    { label: '样本管理', href: '/samples' },
    { label: '样本接收', current: true }
  ],
  '/samples/inventory': [
    { label: '样本管理', href: '/samples' },
    { label: '清点入库', current: true }
  ],
  '/samples/borrow': [
    { label: '样本管理', href: '/samples' },
    { label: '样本领用', current: true }
  ],
  '/samples/transfer': [
    { label: '样本管理', href: '/samples' },
    { label: '样本转移', current: true }
  ],
  '/samples/destroy': [
    { label: '样本管理', href: '/samples' },
    { label: '样本销毁', current: true }
  ],
  '/samples': [
    { label: '样本管理', href: '/samples' },
    { label: '样本查询', current: true }
  ],
  '/projects': [
    { label: '项目管理', href: '/projects' },
    { label: '项目列表', current: true }
  ],
  '/projects/new': [
    { label: '项目管理', href: '/projects' },
    { label: '新建项目', current: true }
  ],
  '/statistics': [
    { label: '统计分析', href: '/statistics' },
    { label: '统计查询', current: true }
  ],
  '/deviation': [
    { label: '统计分析', href: '/statistics' },
    { label: '偏差管理', current: true }
  ],
  '/archive': [
    { label: '统计分析', href: '/statistics' },
    { label: '项目归档', current: true }
  ],
  '/global-params': [
    { label: '系统管理', href: '/global-params' },
    { label: '全局参数', current: true }
  ],
  '/users': [
    { label: '系统管理', href: '/users' },
    { label: '用户管理', current: true }
  ],
  '/audit': [
    { label: '系统管理', href: '/audit' },
    { label: '审计日志', current: true }
  ],
  '/settings': [
    { label: '系统管理', href: '/settings' },
    { label: '系统设置', current: true }
  ],
  '/profile': [
    { label: '个人信息', current: true }
  ],
};

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // 判断当前路径是否匹配
  const isCurrentPath = (href: string) => {
    if (href === '/') {
      return router.pathname === '/';
    }

    if (router.pathname === href) {
      return true;
    }

    if (router.pathname.startsWith(`${href}/`)) {
      const remainder = router.pathname.slice(href.length + 1);
      return remainder.startsWith('[');
    }

    return false;
  };

  // 根据用户角色判断是否显示菜单项
  const shouldShowMenuItem = (roles?: string[]) => {
    if (!roles) return true;
    return roles.includes(user?.role || '');
  };

  // 获取当前页面的面包屑
  const currentBreadcrumb = routeToBreadcrumb[router.pathname] || [];

  return (
    <SidebarLayout
      navbar={
        <div className="flex w-full items-center gap-3">
          {/* 左侧：Logo和标题 */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <Image
              src="/logo.png"
              alt="徐汇区中心医院"
              width={32}
              height={32}
              className="h-8 w-8 flex-shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-800 dark:text-white">
                徐汇区中心医院
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 sm:hidden">
                LIMS
              </div>
              <div className="hidden text-xs text-zinc-600 dark:text-zinc-400 sm:block">
                LIMS系统
              </div>
            </div>
          </div>

          {/* 右侧：用户头像 - 移动端隐藏以节省空间 */}
          {user && (
            <div className="hidden flex-shrink-0 sm:flex">
              <Dropdown>
                <DropdownButton
                  as={Avatar}
                  src={undefined}
                  initials={user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  className="h-9 w-9 text-base"
                />
                <DropdownMenu>
                  <DropdownItem href="/profile">个人信息</DropdownItem>
                  <DropdownItem href="/settings">设置</DropdownItem>
                  <DropdownItem onClick={handleLogout}>
                    <ArrowRightOnRectangleIcon className="h-4 w-4" />
                    退出登录
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          )}
        </div>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 px-2 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
                <BeakerIcon className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">LIMS</div>
                <div className="text-xs text-zinc-400">实验室信息系统</div>
              </div>
            </div>
            <SidebarSection>
              <SidebarItem href="/" current={isCurrentPath('/')}>
                <HomeIcon data-slot="icon" className="!w-4 !h-4" />
                <SidebarLabel>主页</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarHeader>
          
          <SidebarBody>
            <div className="space-y-6">
              {/* 样本管理 */}
              <div>
                <h3 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  样本管理
                </h3>
                <div className="space-y-1">
                  <SidebarItem href="/samples/receive" current={isCurrentPath('/samples/receive')}>
                    <BeakerIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本接收</SidebarLabel>
                    <Badge className="ml-auto bg-gradient-to-r from-green-400 to-green-500 text-zinc-900 text-[10px] font-semibold">NEW</Badge>
                  </SidebarItem>
                  <SidebarItem href="/samples/inventory" current={isCurrentPath('/samples/inventory')}>
                    <ClipboardDocumentListIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>清点入库</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/borrow" current={isCurrentPath('/samples/borrow')}>
                    <ArrowUpOnSquareIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本领用</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/transfer" current={isCurrentPath('/samples/transfer')}>
                    <ArrowsRightLeftIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本转移</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/destroy" current={isCurrentPath('/samples/destroy')}>
                    <TrashIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本销毁</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples" current={isCurrentPath('/samples')}>
                    <MagnifyingGlassIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本查询</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 项目管理 - 仅管理员可见 */}
              {shouldShowMenuItem(['SYSTEM_ADMIN', 'SAMPLE_ADMIN']) && (
                <div>
                  <h3 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    项目管理
                  </h3>
                  <div className="space-y-1">
                    <SidebarItem href="/projects" current={isCurrentPath('/projects')}>
                      <FolderIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>项目列表</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/projects/new" current={isCurrentPath('/projects/new')}>
                      <FolderIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>新建项目</SidebarLabel>
                    </SidebarItem>
                  </div>
                </div>
              )}

              {/* 统计分析 */}
              <div>
                <h3 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  统计分析
                </h3>
                <div className="space-y-1">
                  <SidebarItem href="/statistics" current={isCurrentPath('/statistics')}>
                    <ChartBarIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>统计查询</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/deviation" current={isCurrentPath('/deviation')}>
                    <ExclamationTriangleIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>偏差管理</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/archive" current={isCurrentPath('/archive')}>
                    <ArchiveBoxIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>项目归档</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 系统管理 - 仅管理员可见 */}
              {shouldShowMenuItem(['SYSTEM_ADMIN', 'SAMPLE_ADMIN']) && (
                <div>
                  <h3 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    系统管理
                  </h3>
                  <div className="space-y-1">
                    <SidebarItem href="/global-params" current={isCurrentPath('/global-params')}>
                      <CircleStackIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>全局参数</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/users" current={isCurrentPath('/users')}>
                      <UsersIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>用户管理</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/audit" current={isCurrentPath('/audit')}>
                      <DocumentTextIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>审计日志</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/settings" current={isCurrentPath('/settings')}>
                      <Cog6ToothIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>系统设置</SidebarLabel>
                    </SidebarItem>
                  </div>
                </div>
              )}
            </div>

            <SidebarSpacer />
          </SidebarBody>

          {/* 添加底部登出按钮 */}
          <SidebarFooter>
            <SidebarSection>
              <SidebarItem onClick={handleLogout}>
                <ArrowRightOnRectangleIcon data-slot="icon" className="!w-4 !h-4" />
                <SidebarLabel>退出登录</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <main className="flex-1 overflow-y-auto bg-white">
        {/* 面包屑导航 */}
        {currentBreadcrumb.length > 0 && (
          <div className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
            <Breadcrumb items={currentBreadcrumb} />
          </div>
        )}
        
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </SidebarLayout>
  );
}
