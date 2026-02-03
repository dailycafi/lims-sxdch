import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { SidebarLayout } from '@/components/sidebar-layout';
import { TasksService } from '@/services/tasks.service';
import { SettingsService } from '@/services/settings.service';
import { tokenManager } from '@/lib/token-manager';
import { Breadcrumb, BreadcrumbItem } from '@/components/breadcrumb';

// localStorage 缓存 - 避免重复读取
// 参考: React Best Practices - 7.5 Cache Storage API Calls
const storageCache = new Map<string, string | null>();

function getCachedStorage(key: string): string | null {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key));
  }
  return storageCache.get(key) ?? null;
}

function setCachedStorage(key: string, value: string): void {
  localStorage.setItem(key, value);
  storageCache.set(key, value);
}

function removeCachedStorage(key: string): void {
  localStorage.removeItem(key);
  storageCache.delete(key);
}
import { 
  Sidebar, 
  SidebarBody, 
  SidebarHeader, 
  SidebarSection, 
  SidebarItem,
  SidebarHeading,
  SidebarSpacer,
  SidebarLabel,
  SidebarFooter,
  SidebarToggle,
  SidebarContent,
  useSidebar
} from '@/components/sidebar';
import clsx from 'clsx';

function SidebarHeaderContent({ user }: { user: any }) {
  const { isCollapsed } = useSidebar()

  return (
    <div className={clsx("flex items-center gap-2 px-2 py-4", isCollapsed ? "flex-col-reverse justify-center" : "justify-between")}>
      {user && (
        <Link href="/profile" scroll={false} className={clsx("flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-zinc-800/50", isCollapsed ? "justify-center" : "flex-1 min-w-0")}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 shadow-lg">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
            </svg>
          </div>
          <SidebarContent className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">
              {user.full_name || user.username}
            </div>
            <div className="text-xs text-zinc-400">
              {user.role === 'system_admin' && '系统管理员'}
              {user.role === 'sample_admin' && '样本管理员'}
              {user.role === 'lab_director' && '实验室主任'}
              {user.role === 'test_manager' && '检验科主任'}
              {user.role === 'qa' && '质量管理员'}
              {user.role === 'project_lead' && '项目负责人'}
              {user.role === 'analyst' && '分析员'}
              {!['system_admin', 'sample_admin', 'lab_director', 'test_manager', 'qa', 'project_lead', 'analyst'].includes(user.role) && user.role}
            </div>
          </SidebarContent>
        </Link>
      )}
      <SidebarToggle className={clsx(isCollapsed ? "mb-2" : "")} />
    </div>
  )
}

import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { ProjectSwitcher } from '@/components/project-switcher';
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
  ClipboardDocumentCheckIcon,
  PlusIcon,
  UserIcon,
  ShieldCheckIcon,
  TagIcon,
} from '@heroicons/react/20/solid';

interface AppLayoutProps {
  children: ReactNode;
}

// 路由到面包屑的映射
const routeToBreadcrumb: Record<string, BreadcrumbItem[]> = {
  '/': [],
  '/tasks': [
    { label: '任务中心', current: true }
  ],
  '/samples/inventory': [
    { label: '样本管理', href: '/samples' },
    { label: '清点入库', current: true }
  ],
  '/samples/storage': [
    { label: '样本管理', href: '/samples' },
    { label: '样本存储', current: true }
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
  '/samples/tracking': [
    { label: '样本管理', href: '/samples' },
    { label: '跟踪表', current: true }
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
  '/archive/samples': [
    { label: '统计分析', href: '/statistics' },
    { label: '样本归档', current: true }
  ],
  '/global-params': [
    { label: '系统管理', href: '/settings' },
    { label: '全局参数', current: true }
  ],
  '/audit': [
    { label: '系统管理', href: '/settings' },
    { label: '审计日志', current: true }
  ],
  '/settings': [
    { label: '系统管理', href: '/settings' },
    { label: '系统设置', current: true }
  ],
  '/profile': [
    { label: '个人信息', current: true }
  ],
  '/labels': [
    { label: '工作台', href: '#' },
    { label: '标签管理', current: true }
  ],
};

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { selectedProjectId } = useProjectStore();
  const [pendingTaskCount, setPendingTaskCount] = useState(0);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const STORAGE_KEY = 'lims_last_activity';

  // 使用 useCallback 稳定化 handleActivity 函数
  // 参考: React Best Practices - 8.1 Store Event Handlers in Refs
  const handleActivityRef = useRef<() => void>(() => {});
  handleActivityRef.current = useCallback(() => {
    const now = Date.now();
    setCachedStorage(STORAGE_KEY, now.toString());
  }, []);

  // 处理活动检测
  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    // 稳定的事件处理器，避免重复注册/注销
    const handleActivity = () => handleActivityRef.current?.();

    // 每次组件挂载或用户变更时，重置活动时间为当前，防止读取到旧会话的残留记录
    handleActivity();

    // 监听各种用户活动事件
    // 参考: React Best Practices - 4.1 Deduplicate Global Event Listeners
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(event => window.addEventListener(event, handleActivity));

    // 获取并启动自动登出检查
    const setupAutoLogout = async () => {
      try {
        const timeoutSetting = await SettingsService.getSetting('session_timeout');
        if (!isMounted) return;

        const timeoutMinutes = timeoutSetting.value || 30;
        const timeoutMs = timeoutMinutes * 60 * 1000;

        console.log(`[AutoLogout] Session timeout set to ${timeoutMinutes} minutes (${timeoutMs}ms)`);

        const checkInactivity = () => {
          if (!isMounted) return;

          const now = Date.now();
          // 使用缓存的 localStorage 读取
          const storedActivity = getCachedStorage(STORAGE_KEY);
          // 如果没有存储的活动时间或值无效，使用当前时间（不应该触发登出）
          let lastActivity = now;
          if (storedActivity) {
            const parsed = parseInt(storedActivity, 10);
            if (!isNaN(parsed) && parsed > 0) {
              lastActivity = parsed;
            }
          }
          const inactiveTime = now - lastActivity;

          // 防止负数或异常大的不活动时间（可能是时钟问题或数据损坏）
          if (inactiveTime < 0 || inactiveTime > 24 * 60 * 60 * 1000) {
            console.log(`[AutoLogout] Invalid inactive time: ${inactiveTime}ms, resetting activity`);
            setCachedStorage(STORAGE_KEY, now.toString());
            timeoutIdRef.current = setTimeout(checkInactivity, 60000);
            return;
          }

          console.log(`[AutoLogout] Check: inactive for ${Math.round(inactiveTime / 1000)}s / ${timeoutMinutes * 60}s`);

          if (inactiveTime >= timeoutMs) {
            console.log(`[AutoLogout] Inactive for ${timeoutMinutes} minutes. Logging out...`);
            handleLogout();
          } else {
            // 继续下一次检查，检查频率为 1 分钟或剩余时间的较小值，最小 1 秒
            const nextCheck = Math.max(1000, Math.min(60000, timeoutMs - inactiveTime));
            timeoutIdRef.current = setTimeout(checkInactivity, nextCheck);
          }
        };

        // 延迟一分钟开始第一次检查
        timeoutIdRef.current = setTimeout(checkInactivity, 60000);
      } catch (error) {
        console.error('Failed to setup auto logout:', error);
      }
    };

    setupAutoLogout();

    return () => {
      isMounted = false;
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [user]);

  const handleLogout = async () => {
    removeCachedStorage(STORAGE_KEY);
    await logout();
    router.push('/login');
  };

  // 获取未处理任务数量
  // 优化：只获取少量数据用于统计，避免一次性获取 1000 条
  const fetchPendingTaskCount = async () => {
    // 确保 token 存在再发起请求，避免不必要的 401 错误
    if (!tokenManager.getToken()) {
      console.log('[AppLayout] Skipping task fetch - no token available');
      return;
    }
    
    try {
      // 只获取少量任务用于判断是否有待处理任务
      // 后端理想情况下应该提供一个专门的计数 API
      const overview = await TasksService.getTaskOverview({
        project_id: selectedProjectId ?? undefined,
        limit: 50, // 减少获取数量，只需要知道是否有待处理任务
      });
      
      // 统计需要处理的任务数量（action_required为true的任务）
      const allTasks = [
        ...overview.borrow,
        ...overview.return,
        ...overview.transfer,
        ...overview.destroy,
      ];
      
      const pendingCount = allTasks.filter(task => task.action_required).length;
      setPendingTaskCount(pendingCount);
    } catch (error) {
      console.error('Failed to fetch pending task count:', error);
      setPendingTaskCount(0);
    }
  };

  // 页面加载和项目切换时获取任务数量
  useEffect(() => {
    if (user && tokenManager.getToken()) {
      fetchPendingTaskCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedProjectId]);

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
        <div className="flex w-full items-center justify-between gap-2 sm:gap-4">
          {/* 项目选择器 - 仅在非主页显示 */}
          {router.pathname !== '/' && (
            <div className="flex flex-1 min-w-0 justify-end">
              <ProjectSwitcher />
            </div>
          )}
        </div>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader className="!p-0 border-b-0">
            <SidebarHeaderContent user={user} />
            <SidebarSection className="px-4 pb-4">
              <SidebarItem href="/" scroll={false} current={isCurrentPath('/')}>
                <HomeIcon data-slot="icon" className="!w-4 !h-4" />
                <SidebarLabel>主页</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarHeader>
          
          <SidebarBody>
            <div className="space-y-6">
              {/* 工作台 */}
              <div>
                <SidebarHeading>工作台</SidebarHeading>
                <div className="space-y-1">
                  <SidebarItem href="/tasks" scroll={false} current={isCurrentPath('/tasks')}>
                    <ClipboardDocumentCheckIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>任务中心</SidebarLabel>
                    {pendingTaskCount > 0 && (
                      <SidebarContent className="ml-auto">
                        <Badge className="bg-gradient-to-r from-green-400 to-green-500 text-zinc-900 text-[10px] font-semibold">
                          NEW
                        </Badge>
                      </SidebarContent>
                    )}
                  </SidebarItem>
                  <SidebarItem href="/projects" scroll={false} current={isCurrentPath('/projects')}>
                    <FolderIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>项目管理</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/labels" scroll={false} current={isCurrentPath('/labels')}>
                    <TagIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>标签管理</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 样本管理 */}
              <div>
                <SidebarHeading>样本管理</SidebarHeading>
                <div className="space-y-1">
                  <SidebarItem href="/samples/receive" scroll={false} current={isCurrentPath('/samples/receive')}>
                    <BeakerIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本接收</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/inventory" scroll={false} current={isCurrentPath('/samples/inventory')}>
                    <ClipboardDocumentListIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>清点入库</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/storage" scroll={false} current={isCurrentPath('/storage')}>
                    <ArchiveBoxIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>存储设备</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/borrow" scroll={false} current={isCurrentPath('/samples/borrow')}>
                    <ArrowUpOnSquareIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本作业</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/transfer" scroll={false} current={isCurrentPath('/samples/transfer')}>
                    <ArrowsRightLeftIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本转移</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/destroy" scroll={false} current={isCurrentPath('/samples/destroy')}>
                    <TrashIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本销毁</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples/tracking" scroll={false} current={isCurrentPath('/samples/tracking')}>
                    <DocumentTextIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>跟踪表</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/samples" scroll={false} current={isCurrentPath('/samples')}>
                    <MagnifyingGlassIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本查询</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>


              {/* 统计分析 */}
              <div>
                <SidebarHeading>统计分析</SidebarHeading>
                <div className="space-y-1">
                  <SidebarItem href="/statistics" scroll={false} current={isCurrentPath('/statistics')}>
                    <ChartBarIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>统计查询</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/deviation" scroll={false} current={isCurrentPath('/deviation')}>
                    <ExclamationTriangleIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>偏差管理</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/archive" scroll={false} current={isCurrentPath('/archive')}>
                    <ArchiveBoxIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>项目归档</SidebarLabel>
                  </SidebarItem>
                  <SidebarItem href="/archive/samples" scroll={false} current={isCurrentPath('/archive/samples')}>
                    <ArchiveBoxIcon data-slot="icon" className="!w-4 !h-4" />
                    <SidebarLabel>样本归档</SidebarLabel>
                  </SidebarItem>
                </div>
              </div>

              {/* 系统管理 - 仅管理员可见 */}
              {shouldShowMenuItem(['system_admin', 'sample_admin']) && (
                <div>
                  <SidebarHeading>系统管理</SidebarHeading>
                  <div className="space-y-1">
                    <SidebarItem href="/settings" scroll={false} current={isCurrentPath('/settings')}>
                      <Cog6ToothIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>系统设置</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/global-params" scroll={false} current={isCurrentPath('/global-params')}>
                      <CircleStackIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>全局参数</SidebarLabel>
                    </SidebarItem>
                    <SidebarItem href="/audit" scroll={false} current={isCurrentPath('/audit')}>
                      <DocumentTextIcon data-slot="icon" className="!w-4 !h-4" />
                      <SidebarLabel>审计日志</SidebarLabel>
                    </SidebarItem>
                  </div>
                </div>
              )}
            </div>

            <SidebarSpacer />
          </SidebarBody>

          {/* 底部退出登录 */}
          <SidebarFooter>
            <SidebarSection>
              <SidebarItem onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                <ArrowRightOnRectangleIcon data-slot="icon" className="!w-4 !h-4" />
                <SidebarLabel>退出登录</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <main className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
        {/* 面包屑导航 */}
        {currentBreadcrumb.length > 0 && (
          <div className="border-b border-gray-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 px-4 py-3 sm:px-6">
            <Breadcrumb items={currentBreadcrumb} />
          </div>
        )}
        
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </SidebarLayout>
  );
}
