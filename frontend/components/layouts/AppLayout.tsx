import { ReactNode } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth';
import { SidebarLayout } from '@/components/sidebar-layout';
import { Sidebar, SidebarSection, SidebarItem } from '@/components/sidebar';
import { Navbar } from '@/components/navbar';
import { Dropdown, DropdownButton, DropdownMenu, DropdownItem } from '@/components/dropdown';
import { Avatar } from '@/components/avatar';
import {
  HomeIcon,
  BeakerIcon,
  FolderIcon,
  UsersIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

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

  const navigation = [
    {
      name: '主页',
      href: '/',
      icon: HomeIcon,
    },
    {
      name: '项目管理',
      href: '/projects',
      icon: FolderIcon,
      role: ['SYSTEM_ADMIN', 'SAMPLE_ADMIN'],
    },
    {
      name: '样本管理',
      icon: BeakerIcon,
      children: [
        { name: '样本接收', href: '/samples/receive' },
        { name: '样本查询', href: '/samples' },
        { name: '样本领用', href: '/samples/checkout' },
        { name: '样本归还', href: '/samples/return' },
        { name: '样本转移', href: '/samples/transfer' },
        { name: '样本销毁', href: '/samples/destroy' },
      ],
    },
    {
      name: '用户管理',
      href: '/users',
      icon: UsersIcon,
      role: ['SYSTEM_ADMIN', 'SAMPLE_ADMIN'],
    },
    {
      name: '统计报表',
      href: '/reports',
      icon: ChartBarIcon,
    },
    {
      name: '审计日志',
      href: '/audit',
      icon: DocumentTextIcon,
    },
    {
      name: '系统设置',
      href: '/settings',
      icon: Cog6ToothIcon,
      role: ['SYSTEM_ADMIN'],
    },
  ];

  // 根据用户角色过滤导航项
  const filteredNavigation = navigation.filter((item) => {
    if (!item.role) return true;
    return item.role.includes(user?.role || '');
  });

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
                  <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                  退出登录
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          {filteredNavigation.map((section) => (
            <SidebarSection key={section.name}>
              {section.children ? (
                <>
                  <div className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {section.name}
                  </div>
                  {section.children.map((item) => (
                    <SidebarItem key={item.name} href={item.href}>
                      {item.name}
                    </SidebarItem>
                  ))}
                </>
              ) : (
                <SidebarItem href={section.href}>
                  {section.icon && <section.icon className="h-5 w-5 mr-3" />}
                  {section.name}
                </SidebarItem>
              )}
            </SidebarSection>
          ))}
        </Sidebar>
      }
    >
      <main className="p-6">{children}</main>
    </SidebarLayout>
  );
}
