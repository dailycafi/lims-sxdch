import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';
import { tokenManager } from '@/lib/token-manager';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { TasksService, StatisticsService } from '@/services';
import { formatDate } from '@/lib/date-utils';
import { TaskOverview, Statistics } from '@/types/api';
import {
  ClipboardDocumentCheckIcon,
  FolderIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { projects, selectedProjectId, setSelectedProject, fetchProjects } = useProjectStore();
  const [taskOverview, setTaskOverview] = useState<TaskOverview | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取所有任务并排序
  const recentTasks = useMemo(() => {
    if (!taskOverview) return [];
    return [
      ...taskOverview.borrow,
      ...taskOverview.return,
      ...taskOverview.transfer,
      ...taskOverview.destroy,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [taskOverview]);

  // 用于防止重复请求
  const [hasFetchedData, setHasFetchedData] = useState(false);

  const fetchDashboardData = async (force = false) => {
    // 确保 token 存在再发起请求
    if (!user || !tokenManager.getToken()) {
      return;
    }

    // 防止重复获取（除非强制刷新）
    if (hasFetchedData && !force) {
      return;
    }

    setLoading(true);
    setHasFetchedData(true);
    try {
      // 并行获取任务概览和统计数据
      const [taskData, statsData] = await Promise.all([
        TasksService.getTaskOverview({
          project_id: selectedProjectId ?? undefined,
          limit: 50,
        }).catch(() => null),
        StatisticsService.getOverviewStatistics().catch(() => null),
      ]);

      setTaskOverview(taskData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('获取数据失败');
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
    if (isAuthenticated && user && tokenManager.getToken()) {
      fetchProjects({ activeOnly: true });
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  // 选中项目变化时重新获取任务数据
  useEffect(() => {
    if (isAuthenticated && user && tokenManager.getToken() && selectedProjectId) {
      fetchDashboardData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

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
      <div className="min-h-screen bg-gray-50">
        {/* 主要内容区域 - 20%/80% 布局 */}
        <div className="flex gap-6 items-start">
          {/* 左侧：在研项目列表 - 20% */}
          <div className="w-1/5 flex-shrink-0">
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden sticky top-4">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <FolderIcon className="h-5 w-5 text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">在研项目</h3>
                </div>
              </div>
              <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
                {projects.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {projects.filter(p => p.is_active && !p.is_archived).map((project) => (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProject(project.id)}
                        className={clsx(
                          "p-3 cursor-pointer transition-colors",
                          selectedProjectId === project.id
                            ? "bg-blue-50 border-l-2 border-blue-500"
                            : "hover:bg-gray-50"
                        )}
                      >
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {project.lab_project_code}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-1">
                          {project.sponsor?.name || project.sponsor_project_code}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    暂无在研项目
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：任务中心 - 80% */}
          <div className="flex-1">
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">任务中心</h3>
                  {selectedProjectId && (
                    <Badge color="blue" className="ml-2">
                      {projects.find(p => p.id === selectedProjectId)?.lab_project_code}
                    </Badge>
                  )}
                </div>
                <Button
                  outline
                  onClick={() => fetchDashboardData(true)}
                  disabled={loading}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <ArrowPathIcon className={clsx('h-4 w-4', loading && 'animate-spin')} />
                  刷新
                </Button>
              </div>

              {loading ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, index) => (
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
                <div className="p-6">
                  <div className="space-y-3">
                    {recentTasks.map((task) => (
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
                            <span>{formatDate(task.created_at)}</span>
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
                <div className="py-16 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <ClipboardDocumentCheckIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">暂无待处理任务</p>
                    <p className="text-sm text-gray-400 mt-1">所有任务都已完成</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
