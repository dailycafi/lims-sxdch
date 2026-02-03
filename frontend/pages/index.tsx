import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ProjectListPanel } from '@/components/homepage/ProjectListPanel';
import { TaskCenterPanel } from '@/components/homepage/TaskCenterPanel';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] -m-4 sm:-m-6">
        {/* 左侧 20% - 在研项目列表 */}
        <div className="w-1/5 min-w-[200px] max-w-[300px] border-r border-gray-200">
          <ProjectListPanel />
        </div>

        {/* 右侧 80% - 任务中心 */}
        <div className="flex-1 overflow-hidden bg-white">
          <TaskCenterPanel />
        </div>
      </div>
    </AppLayout>
  );
}
