import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { UserAccessService } from '@/services/user-access.service';

// 页面配置映射
const pageConfig: Record<string, { title: string; icon?: string }> = {
  '/': { title: '工作台', icon: 'ChartBarIcon' },
  '/samples': { title: '样本管理', icon: 'BeakerIcon' },
  '/samples/receive': { title: '样本接收', icon: 'BeakerIcon' },
  '/samples/borrow': { title: '样本借用', icon: 'BeakerIcon' },
  '/samples/transfer': { title: '样本转移', icon: 'BeakerIcon' },
  '/samples/destroy': { title: '样本销毁', icon: 'BeakerIcon' },
  '/projects': { title: '项目管理', icon: 'FolderIcon' },
  '/tasks': { title: '任务中心', icon: 'ClipboardDocumentCheckIcon' },
  '/audit': { title: '审计日志', icon: 'DocumentTextIcon' },
  '/statistics': { title: '统计查询', icon: 'ChartBarIcon' },
  '/profile': { title: '个人设置', icon: 'UsersIcon' },
  '/global-params': { title: '全局参数', icon: 'CogIcon' },
  '/deviation': { title: '偏差管理', icon: 'ExclamationTriangleIcon' },
  '/archive': { title: '项目归档', icon: 'FolderIcon' },
};

/**
 * 自动记录页面访问的Hook
 */
export function usePageTracking() {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // 清理URL参数，只保留路径
      const cleanPath = url.split('?')[0];
      const config = pageConfig[cleanPath];
      
      // 排除工作台页面，不记录访问
      if (config && cleanPath !== '/') {
        // 延迟记录，确保页面已完全加载
        setTimeout(() => {
          UserAccessService.trackAccess(cleanPath, config.title, config.icon);
        }, 1000);
      }
    };

    // 记录当前页面
    handleRouteChange(router.asPath);

    // 监听路由变化
    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);
}
