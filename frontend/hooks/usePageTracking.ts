import { useEffect, useRef, useCallback } from 'react';
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
 * 修复：使用 ref 追踪定时器，在组件卸载或路由变化时清理
 */
export function usePageTracking() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTrackedPathRef = useRef<string | null>(null);

  // 清理定时器的函数
  const clearTrackingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // 清理之前的定时器，避免快速导航时积累多个定时器
      clearTrackingTimeout();
      
      // 清理URL参数，只保留路径
      const cleanPath = url.split('?')[0];
      
      // 避免重复记录同一页面
      if (cleanPath === lastTrackedPathRef.current) {
        return;
      }
      
      const config = pageConfig[cleanPath];
      
      // 排除工作台页面，不记录访问
      if (config && cleanPath !== '/') {
        // 延迟记录，确保页面已完全加载
        timeoutRef.current = setTimeout(() => {
          UserAccessService.trackAccess(cleanPath, config.title, config.icon);
          lastTrackedPathRef.current = cleanPath;
        }, 1000);
      }
    };

    // 记录当前页面
    handleRouteChange(router.asPath);

    // 监听路由变化
    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      // 组件卸载时清理定时器
      clearTrackingTimeout();
    };
  }, [router, clearTrackingTimeout]);
}
