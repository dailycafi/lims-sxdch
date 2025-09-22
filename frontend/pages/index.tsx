import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { AnimatedLoadingState } from '@/components/animated-table';
import Link from 'next/link';
import { TasksService, StatisticsService } from '@/services';
import { TaskOverview, Statistics } from '@/types/api';
import { 
  ClipboardDocumentCheckIcon, 
  ChartBarIcon, 
  BeakerIcon, 
  FolderIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

// 根据用户角色获取统计信息类型
const getRoleBasedStatsConfig = (role: string) => {
  switch (role) {
    case 'system_admin':
      return {
        title: '系统管理统计',
        items: [
          { key: 'total_users', label: '用户总数', icon: UsersIcon },
          { key: 'total_projects', label: '项目总数', icon: FolderIcon },
          { key: 'total_samples', label: '样本总数', icon: BeakerIcon },
          { key: 'audit_logs_today', label: '今日操作', icon: ClipboardDocumentCheckIcon },
        ]
      };
    case 'lab_director':
    case 'test_manager':
    case 'qa':
      return {
        title: '审批管理统计',
        items: [
          { key: 'pending_approvals', label: '待审批任务', icon: ExclamationTriangleIcon },
          { key: 'approved_today', label: '今日已审批', icon: ClipboardDocumentCheckIcon },
          { key: 'active_projects', label: '活跃项目', icon: FolderIcon },
          { key: 'total_samples', label: '样本总数', icon: BeakerIcon },
        ]
      };
    case 'sample_admin':
      return {
        title: '样本管理统计',
        items: [
          { key: 'in_storage', label: '在库样本', icon: BeakerIcon },
          { key: 'checked_out', label: '已领用', icon: ArrowTopRightOnSquareIcon },
          { key: 'pending_tasks', label: '待处理任务', icon: ExclamationTriangleIcon },
          { key: 'processed_today', label: '今日处理', icon: ClipboardDocumentCheckIcon },
        ]
      };
    case 'project_lead':
    case 'analyst':
      return {
        title: '项目工作统计',
        items: [
          { key: 'my_tasks', label: '我的任务', icon: ClipboardDocumentCheckIcon },
          { key: 'my_samples', label: '我的样本', icon: BeakerIcon },
          { key: 'pending_approvals', label: '待审批', icon: ExclamationTriangleIcon },
          { key: 'completed_today', label: '今日完成', icon: ChartBarIcon },
        ]
      };
    default:
      return {
        title: '工作统计',
        items: [
          { key: 'total_samples', label: '样本总数', icon: BeakerIcon },
          { key: 'active_projects', label: '活跃项目', icon: FolderIcon },
          { key: 'my_tasks', label: '我的任务', icon: ClipboardDocumentCheckIcon },
          { key: 'recent_activities', label: '最近活动', icon: ChartBarIcon },
        ]
      };
  }
};

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { selectedProjectId } = useProjectStore();
  const [taskOverview, setTaskOverview] = useState<TaskOverview | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);

  // 所有hooks都必须在组件顶层调用
  const roleStatsConfig = useMemo(() => {
    return user?.role ? getRoleBasedStatsConfig(user.role) : null;
  }, [user?.role]);

  // 获取最近的任务 - 移到hooks顶层
  const recentTasks = useMemo(() => {
    if (!taskOverview) return [];
    return [
      ...taskOverview.borrow,
      ...taskOverview.return,
      ...taskOverview.transfer,
      ...taskOverview.destroy,
    ].slice(0, 5).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [taskOverview]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 并行获取任务概览和统计数据
      const [taskData, statsData] = await Promise.all([
        TasksService.getTaskOverview({
          project_id: selectedProjectId ?? undefined,
          limit: 5,
        }).catch(() => null),
        StatisticsService.getOverviewStatistics().catch(() => null),
      ]);
      
      setTaskOverview(taskData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('获取仪表板数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, selectedProjectId]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const quickActions = [
    { name: '样本接收', href: '/samples/receive', description: '接收新的样本', icon: BeakerIcon },
    { name: '样本查询', href: '/samples', description: '查询和管理样本', icon: BeakerIcon },
    { name: '任务中心', href: '/tasks', description: '查看待处理任务', icon: ClipboardDocumentCheckIcon },
    { name: '统计查询', href: '/statistics', description: '查看统计分析数据', icon: ChartBarIcon },
  ];

  const handleTaskClick = (task: any) => {
    const params = new URLSearchParams({
      taskId: String(task.id),
      taskType: task.category,
    });

    switch (task.category) {
      case 'borrow':
        router.push(`/samples/borrow?${params.toString()}`);
        break;
      case 'return':
        params.set('view', 'borrowed');
        router.push(`/samples/borrow?${params.toString()}`);
        break;
      case 'transfer':
        router.push(`/samples/transfer?${params.toString()}`);
        break;
      case 'destroy':
        router.push(`/samples/destroy?${params.toString()}`);
        break;
      default:
        break;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* 欢迎区域 */}
        <div className="flex items-center justify-between">
          <div>
            <Heading level={1}>欢迎使用LIMS系统</Heading>
            <Text className="mt-2 text-gray-600">
              您好，{user?.full_name}！您的角色是 {user?.role}
            </Text>
          </div>
          <Button outline onClick={fetchDashboardData} disabled={loading}>
            <ArrowPathIcon className={clsx('h-4 w-4', loading && 'animate-spin')} />
            刷新数据
          </Button>
        </div>

        {/* 快速操作 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.name} href={action.href}>
              <div className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <action.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{action.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">{action.description}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 角色相关统计 */}
          {roleStatsConfig && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{roleStatsConfig.title}</h3>
                <ChartBarIcon className="h-5 w-5 text-gray-400" />
              </div>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-8 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="space-y-4">
                  {roleStatsConfig.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-gray-500" />
                        <dt className="text-sm text-gray-600">{item.label}</dt>
                      </div>
                      <dd className="text-sm font-medium text-gray-900">
                        {statistics?.[item.key as keyof Statistics] ?? '-'}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {/* 最近任务 */}
          <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between p-6 pb-4">
              <h3 className="text-lg font-medium text-gray-900">最近任务</h3>
              <Link href="/tasks">
                <Button size="sm" outline>查看全部</Button>
              </Link>
            </div>
            
            {loading ? (
              <div className="px-6 pb-6">
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                      </div>
                      <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                      <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                      <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : recentTasks.length > 0 ? (
              <Table bleed>
                <TableHead>
                  <TableRow>
                    <TableHeader>任务</TableHeader>
                    <TableHeader>状态</TableHeader>
                    <TableHeader>创建时间</TableHeader>
                    <TableHeader>操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTasks.map((task) => (
                    <TableRow key={`${task.category}-${task.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{task.title}</span>
                          <span className="text-xs text-gray-500">{task.project_code}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color={task.action_required ? 'red' : 'blue'}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {new Date(task.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          outline 
                          onClick={() => handleTaskClick(task)}
                        >
                          处理
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="px-6 pb-6 text-center text-gray-500">
                <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2">暂无最近任务</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
