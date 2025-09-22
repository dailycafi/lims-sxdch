import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserAccessService, AccessRecord } from '@/services/user-access.service';
import { 
  BeakerIcon,
  FolderIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/20/solid';

// 图标映射
const iconMap: Record<string, any> = {
  BeakerIcon,
  FolderIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  ChartBarIcon,
  CogIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
};

// 默认快速访问配置（排除工作台）
const defaultShortcuts = [
  { path: '/samples', title: '样本管理', icon: 'BeakerIcon' },
  { path: '/projects', title: '项目管理', icon: 'FolderIcon' },
  { path: '/tasks', title: '任务中心', icon: 'ClipboardDocumentCheckIcon' },
  { path: '/audit', title: '审计日志', icon: 'DocumentTextIcon' },
];

interface SmartShortcutsProps {
  className?: string;
}

export function SmartShortcuts({ className = '' }: SmartShortcutsProps) {
  const [shortcuts, setShortcuts] = useState<AccessRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShortcuts();
  }, []);

  const loadShortcuts = async () => {
    try {
      setLoading(true);
      // 获取最常访问的页面
      const frequentAccess = await UserAccessService.getFrequentAccess(8);
      
      // 过滤掉工作台页面
      const filteredAccess = frequentAccess.filter(item => item.path !== '/');
      
      if (filteredAccess.length > 0) {
        // 如果有访问记录，使用最常访问的页面（不显示访问次数）
        setShortcuts(filteredAccess.slice(0, 4).map(item => ({
          ...item,
          access_count: 0 // 不显示访问次数
        })));
      } else {
        // 如果没有访问记录，使用默认配置
        setShortcuts(defaultShortcuts.map(item => ({
          ...item,
          access_count: 0
        })));
      }
    } catch (error) {
      console.error('Failed to load shortcuts:', error);
      // 出错时使用默认配置
      setShortcuts(defaultShortcuts.map(item => ({
        ...item,
        access_count: 0
      })));
    } finally {
      setLoading(false);
    }
  };

  const handleShortcutClick = async (shortcut: AccessRecord) => {
    // 记录访问
    await UserAccessService.trackAccess(shortcut.path, shortcut.title, shortcut.icon);
  };

  const getIcon = (iconName?: string) => {
    if (!iconName || !iconMap[iconName]) {
      return CogIcon; // 默认图标
    }
    return iconMap[iconName];
  };

  if (loading) {
    return (
      <div className={`grid grid-cols-2 gap-3 ${className}`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="p-4 rounded-lg bg-gray-50 animate-pulse">
            <div className="h-6 w-6 bg-gray-200 rounded mx-auto mb-2" />
            <div className="h-3 w-16 bg-gray-200 rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {shortcuts.map((shortcut, index) => {
        const IconComponent = getIcon(shortcut.icon);
        return (
          <Link 
            key={`${shortcut.path}-${index}`} 
            href={shortcut.path} 
            className="group"
            onClick={() => handleShortcutClick(shortcut)}
          >
            <div className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-center border border-transparent hover:border-gray-200">
              <IconComponent className="h-6 w-6 text-gray-600 mx-auto mb-2" />
              <span className="text-xs text-gray-700 font-medium block truncate">
                {shortcut.title}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
