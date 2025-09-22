import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Heading } from '@/components/heading';
import { Text } from '@/components/text';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/table';
import { AnimatedLoadingState } from '@/components/animated-table';
import Link from 'next/link';
import { TasksService, StatisticsService, UserAccessService } from '@/services';
import { SmartShortcuts } from '@/components/smart-shortcuts';
import { TaskOverview, Statistics } from '@/types/api';
import { 
  ClipboardDocumentCheckIcon, 
  ChartBarIcon, 
  BeakerIcon, 
  FolderIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

// 根据用户角色获取dashboard配置
const getRoleBasedDashboardConfig = (role: string) => {
  switch (role) {
    case 'system_admin':
      return {
        title: '系统管理中心',
        subtitle: '管理项目和样本数据',
        primaryMetrics: [
          { 
            key: 'total_projects', 
            label: '项目总数', 
            icon: FolderIcon, 
            suffix: '个'
          },
          { 
            key: 'total_samples', 
            label: '样本总数', 
            icon: BeakerIcon, 
            suffix: '份'
          },
          { 
            key: 'pending_approvals', 
            label: '待审批任务', 
            icon: ExclamationTriangleIcon, 
            suffix: '项',
            urgent: true
          },
        ]
      };
    case 'lab_director':
    case 'test_manager':
    case 'qa':
      return {
        title: '质量管理中心',
        subtitle: '监控审批流程和质量指标',
        primaryMetrics: [
          { 
            key: 'pending_approvals', 
            label: '待审批', 
            icon: ExclamationTriangleIcon, 
            suffix: '项',
            urgent: true
          },
          { 
            key: 'approved_today', 
            label: '今日审批', 
            icon: CheckCircleIcon, 
            suffix: '项',
            trend: '+15%'
          },
          { 
            key: 'active_projects', 
            label: '活跃项目', 
            icon: FolderIcon, 
            suffix: '个'
          },
        ]
      };
    case 'sample_admin':
      return {
        title: '样本管理中心',
        subtitle: '监控样本库存和流转状态',
        primaryMetrics: [
          { 
            key: 'in_storage', 
            label: '库存样本', 
            icon: BeakerIcon, 
            suffix: '份'
          },
          { 
            key: 'checked_out', 
            label: '已领用', 
            icon: ArrowTopRightOnSquareIcon, 
            suffix: '份'
          },
          { 
            key: 'processed_today', 
            label: '今日处理', 
            icon: ClipboardDocumentCheckIcon, 
            suffix: '份',
            trend: '+10%'
          },
        ]
      };
    case 'project_lead':
    case 'analyst':
      return {
        title: '个人工作台',
        subtitle: '管理您的任务和项目进度',
        primaryMetrics: [
          { 
            key: 'my_tasks', 
            label: '待办任务', 
            icon: ClipboardDocumentCheckIcon, 
            suffix: '项',
            urgent: true
          },
          { 
            key: 'my_samples', 
            label: '负责样本', 
            icon: BeakerIcon, 
            suffix: '份'
          },
          { 
            key: 'completed_today', 
            label: '今日完成', 
            icon: CheckCircleIcon, 
            suffix: '项',
            trend: '+20%'
          },
        ]
      };
    default:
      return {
        title: '工作概览',
        subtitle: '查看您的工作状态',
        primaryMetrics: [
          { 
            key: 'my_tasks', 
            label: '我的任务', 
            icon: ClipboardDocumentCheckIcon, 
            suffix: '项'
          },
          { 
            key: 'active_projects', 
            label: '参与项目', 
            icon: FolderIcon, 
            suffix: '个'
          },
        ]
      };
  }
};

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [taskOverview, setTaskOverview] = useState<TaskOverview | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);

  // 所有hooks都必须在组件顶层调用
  const dashboardConfig = useMemo(() => {
    return user?.role ? getRoleBasedDashboardConfig(user.role) : null;
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
      // 并行获取全局任务概览和统计数据（不限制项目）
      const [taskData, statsData] = await Promise.all([
        TasksService.getTaskOverview({
          limit: 5, // 移除项目限制，显示所有项目的任务
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
  }, [isAuthenticated, user]); // 移除 selectedProjectId 依赖

  if (isLoading || !isAuthenticated) {
    return null;
  }

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
      <div className="min-h-screen bg-gray-50 space-y-8">
        {/* 现代化欢迎区域 - 黑白主基调 */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-sm">
          {/* 简洁的漂浮斜矩形装饰 */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-5">
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-600 transform rotate-12 rounded-3xl animate-float-slow"></div>
          </div>
          
          <div className="relative p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-gray-500 text-sm">
                    {new Date().toLocaleDateString('zh-CN', { 
                      year: 'numeric',
                      month: 'long', 
                      day: 'numeric',
                      weekday: 'long'
                    })}
                  </span>
                </div>
                <Heading level={1} className="text-gray-900 text-3xl font-bold mb-2">
                  {dashboardConfig?.title || '工作台'}
                </Heading>
                <Text className="text-gray-600 text-lg">
                  {dashboardConfig?.subtitle || `您好，${user?.full_name}！欢迎使用LIMS系统`}
                </Text>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-gray-500">
                  <div className="text-sm font-mono">
                    {new Date().toLocaleTimeString('zh-CN', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
                <Button 
                  outline 
                  onClick={fetchDashboardData} 
                  disabled={loading}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <ArrowPathIcon className={clsx('h-4 w-4', loading && 'animate-spin')} />
                  刷新数据
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 核心指标卡片 - 简洁黑白设计 */}
        {dashboardConfig && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardConfig.primaryMetrics.map((metric) => (
              <div
                key={metric.key}
                className={clsx(
                  "relative overflow-hidden rounded-xl bg-white border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1",
                  metric.urgent ? "border-red-200 bg-red-50/30" : "border-gray-200"
                )}
              >
                {/* 简洁的装饰线条 */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-900 to-gray-600" />
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={clsx(
                      "p-3 rounded-lg",
                      metric.urgent ? "bg-red-100" : "bg-gray-100"
                    )}>
                      <metric.icon className={clsx(
                        "h-6 w-6",
                        metric.urgent ? "text-red-600" : "text-gray-700"
                      )} />
                    </div>
                    {metric.urgent && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs text-red-600 font-medium">紧急</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">
                      {metric.label}
                    </p>
                    <div className="flex items-end justify-between">
                      <div className="flex items-baseline gap-2">
                        {loading ? (
                          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                        ) : (
                          <span className="text-3xl font-bold text-gray-900">
                            {statistics?.[metric.key as keyof Statistics] ?? '-'}
                          </span>
                        )}
                        <span className="text-sm text-gray-500 font-mono">
                          {metric.suffix}
                        </span>
                      </div>
                      {metric.trend && (
                        <div className="flex items-center gap-1">
                          <div className={clsx(
                            "text-xs font-medium px-2 py-1 rounded-full",
                            metric.trend.startsWith('+') 
                              ? 'text-green-700 bg-green-100' 
                              : 'text-red-700 bg-red-100'
                          )}>
                            {metric.trend}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* 最近任务 - 占2/3宽度 */}
          <div className="lg:col-span-2">
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[32rem]">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">任务</h3>
                </div>
                <Link href="/tasks">
                  <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                    查看全部
                  </Button>
                </Link>
              </div>
              
              {loading ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-gray-50">
                        <div className="h-10 w-10 bg-gray-200 rounded-lg animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                          <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                        </div>
                        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : recentTasks.length > 0 ? (
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className="space-y-3">
                    {recentTasks.slice(0, 5).map((task, index) => (
                      <div
                        key={`${task.category}-${task.id}`}
                        className="group flex items-center gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200"
                        onClick={() => handleTaskClick(task)}
                      >
                        <div className="flex-shrink-0">
                          <div className={clsx(
                            "p-2 rounded-lg",
                            task.action_required ? "bg-red-100" : "bg-gray-200"
                          )}>
                            <ClipboardDocumentCheckIcon className={clsx(
                              "h-5 w-5",
                              task.action_required ? "text-red-600" : "text-gray-600"
                            )} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-gray-900 font-medium truncate">
                              {task.title}
                            </p>
                            <Badge 
                              color={task.action_required ? 'red' : 'blue'}
                              className="flex-shrink-0"
                            >
                              {task.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="font-mono">{task.project_code}</span>
                            <span>•</span>
                            <span>{new Date(task.created_at).toLocaleDateString('zh-CN')}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <ClipboardDocumentCheckIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">暂无最近任务</p>
                    <p className="text-sm text-gray-400 mt-1">完成的任务将显示在这里</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右侧边栏 - 占1/3宽度 */}
          <div className="flex flex-col gap-6 min-h-[32rem]">
            {/* 工作概览 */}
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-100">
                  <ChartBarIcon className="h-5 w-5 text-gray-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">工作概览</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">在库样本</span>
                  <span className="text-gray-900 text-sm font-medium">
                    {statistics?.in_storage ?? '-'} 份
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">已领用样本</span>
                  <span className="text-gray-900 text-sm font-medium">
                    {statistics?.checked_out ?? '-'} 份
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">活跃项目</span>
                  <span className="text-gray-900 text-sm font-medium">
                    {statistics?.active_projects ?? '-'} 个
                  </span>
                </div>
              </div>
            </div>

            {/* 智能快速访问 */}
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-100">
                  <CpuChipIcon className="h-5 w-5 text-gray-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">快速访问</h3>
                <div className="ml-auto">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">智能推荐</span>
                </div>
              </div>
              <SmartShortcuts />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
