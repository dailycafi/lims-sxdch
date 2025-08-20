import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { Image } from '@/components/image';
import { useAuthStore } from '@/store/auth';
import { SidebarLayout } from '@/components/sidebar-layout';
import { 
  Sidebar, 
  SidebarBody, 
  SidebarHeader, 
  SidebarSection, 
  SidebarItem,
  SidebarHeading,
  SidebarSpacer,
  SidebarLabel
} from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
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
} from '@heroicons/react/20/solid';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // 判断当前路径是否匹配
  const isCurrentPath = (href: string) => {
    return router.pathname === href;
  };

  // 根据用户角色判断是否显示菜单项
  const shouldShowMenuItem = (roles?: string[]) => {
    if (!roles) return true;
    return roles.includes(user?.role || '');
  };

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="徐汇区中心医院"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <div className="text-lg font-semibold text-zinc-800 dark:text-white">
                徐汇区中心医院 LIMS系统
              </div>
            </div>
            <Dropdown>
              <DropdownButton as={Avatar} src={undefined} initials={user?.full_name?.charAt(0)} />
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
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarSection>
              <SidebarItem href="/" current={isCurrentPath('/')}>
                <HomeIcon data-slot="icon" className="!w-5 !h-5" />
                <SidebarLabel>主页</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarHeader>
          
          <SidebarBody>
            {/* 样本管理 */}
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center">
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    样本管理
                  </h3>
                  <Badge color="green" className="ml-2 text-xs">New</Badge>
                </div>
                <div className="relative space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                  <SidebarItem href="/samples/receive" current={isCurrentPath('/samples/receive')}>
                    <BeakerIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>样本接收</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/borrow" current={isCurrentPath('/samples/borrow')}>
                    <ArrowUpOnSquareIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>样本领用</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/transfer" current={isCurrentPath('/samples/transfer')}>
                    <ArrowsRightLeftIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>样本转移</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/destroy" current={isCurrentPath('/samples/destroy')}>
                    <TrashIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>样本销毁</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples" current={isCurrentPath('/samples')}>
                    <BeakerIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>样本查询</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 项目管理 - 仅管理员可见 */}
              {shouldShowMenuItem(['SYSTEM_ADMIN', 'SAMPLE_ADMIN']) && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    项目管理
                  </h3>
                  <div className="relative space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                    <SidebarItem href="/projects" current={isCurrentPath('/projects')}>
                      <FolderIcon data-slot="icon" className="!w-5 !h-5" />
                      <SidebarLabel>项目列表</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/projects/new" current={isCurrentPath('/projects/new')}>
                      <FolderIcon data-slot="icon" className="!w-5 !h-5" />
                      <SidebarLabel>新建项目</SidebarLabel>
                    </SidebarItem>
                  </div>
                </div>
              )}

              {/* 统计分析 */}
              <div>
                <h3 className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  统计分析
                </h3>
                <div className="relative space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                  <SidebarItem href="/statistics" current={isCurrentPath('/statistics')}>
                    <ChartBarIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>统计查询</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/deviation" current={isCurrentPath('/deviation')}>
                    <ExclamationTriangleIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>偏差管理</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/archive" current={isCurrentPath('/archive')}>
                    <ArchiveBoxIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>项目归档</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 系统管理 */}
              {shouldShowMenuItem(['SYSTEM_ADMIN', 'SAMPLE_ADMIN']) && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    系统管理
                  </h3>
                  <div className="relative space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                    <SidebarItem href="/global-params" current={isCurrentPath('/global-params')}>
                      <CircleStackIcon data-slot="icon" className="!w-5 !h-5" />
                      <SidebarLabel>全局参数</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/users" current={isCurrentPath('/users')}>
                      <UsersIcon data-slot="icon" className="!w-5 !h-5" />
                      <SidebarLabel>用户管理</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/audit" current={isCurrentPath('/audit')}>
                      <DocumentTextIcon data-slot="icon" className="!w-5 !h-5" />
                      <SidebarLabel>审计日志</SidebarLabel>
                    </SidebarItem>
                  </div>
                </div>
              )}

              {/* 统计与报表 */}
              <div>
                <h3 className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  统计与报表
                </h3>
                <div className="relative space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                  <SidebarItem href="/reports" current={isCurrentPath('/reports')}>
                    <ChartBarIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>统计报表</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/audit" current={isCurrentPath('/audit')}>
                    <DocumentTextIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>审计日志</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 其他功能 */}
              <div>
                <div className="mb-2 flex items-center">
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    其他功能
                  </h3>
                  <Badge color="blue" className="ml-2 text-xs">Beta</Badge>
                </div>
                <div className="relative space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                  <SidebarItem href="/deviation" current={isCurrentPath('/deviation')}>
                    <ExclamationTriangleIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>偏差管理</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/archive" current={isCurrentPath('/archive')}>
                    <ArchiveBoxIcon data-slot="icon" className="!w-5 !h-5" />
                    <SidebarLabel>项目归档</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 系统设置 - 仅系统管理员可见 */}
              {shouldShowMenuItem(['SYSTEM_ADMIN']) && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    系统设置
                  </h3>
                  <div className="relative space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                    <SidebarItem href="/settings" current={isCurrentPath('/settings')}>
                      <Cog6ToothIcon data-slot="icon" className="!w-5 !h-5" />
                      <SidebarLabel>系统设置</SidebarLabel>
                    </SidebarItem>
                  </div>
                </div>
              )}
            </div>

            <SidebarSpacer />
          </SidebarBody>
        </Sidebar>
      }
    >
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">{children}</div>
      </main>
    </SidebarLayout>
  );
}