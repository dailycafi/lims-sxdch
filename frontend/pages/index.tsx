import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const quickActions = [
    { name: '项目管理', href: '/projects', description: '创建和管理实验项目' },
    { name: '样本接收', href: '/samples/receive', description: '接收新的样本' },
    { name: '样本查询', href: '/samples', description: '查询和管理样本' },
    { name: '审计日志', href: '/audit', description: '查看系统操作记录' },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <Heading level={1}>欢迎使用LIMS系统</Heading>
          <Text className="mt-2 text-gray-600">
            您好，{user?.full_name}！您的角色是 {user?.role}
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <div
              key={action.name}
              className="relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <h3 className="text-lg font-medium text-gray-900">{action.name}</h3>
                <p className="mt-2 text-sm text-gray-500">{action.description}</p>
              </div>
              <div className="mt-4">
                <Link href={action.href}>
                  <Button outline>进入</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900">系统统计</h3>
            <dl className="mt-4 space-y-4">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">活跃项目</dt>
                <dd className="text-sm font-medium text-gray-900">12</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">在库样本</dt>
                <dd className="text-sm font-medium text-gray-900">3,456</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">待处理任务</dt>
                <dd className="text-sm font-medium text-gray-900">8</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900">最近活动</h3>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">暂无最近活动</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
