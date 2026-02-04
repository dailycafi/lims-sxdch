import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '@/store/project';
import { Text } from '@/components/text';
import { Badge } from '@/components/badge';
import { FolderIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

interface Project {
  id: number;
  lab_project_code: string;
  sponsor_project_code?: string;
  status?: string | null;
  sample_count?: number;
}

export function ProjectListPanel() {
  const { projects, selectedProjectId, setSelectedProject } = useProjectStore();
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);

  useEffect(() => {
    const active = projects.filter(p => p.status === 'active' || p.status === 'in_progress');
    setActiveProjects(active);
  }, [projects]);

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'active':
      case 'in_progress':
        return 'green';
      case 'pending':
        return 'yellow';
      case 'completed':
        return 'blue';
      default:
        return 'zinc';
    }
  };

  const getStatusLabel = (status: string | null | undefined) => {
    switch (status) {
      case 'active':
      case 'in_progress':
        return '进行中';
      case 'pending':
        return '待开始';
      case 'completed':
        return '已完成';
      default:
        return status;
    }
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="flex items-center gap-2">
          <FolderIcon className="h-5 w-5 text-gray-600" />
          <h2 className="text-base font-semibold text-gray-900">在研项目</h2>
          <Badge color="blue" className="ml-auto">
            {activeProjects.length}
          </Badge>
        </div>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeProjects.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <FolderIcon className="mx-auto h-10 w-10 text-gray-300" />
              <Text className="mt-2 text-gray-500">暂无在研项目</Text>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {activeProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setSelectedProject(project.id)}
                className={clsx(
                  'group w-full rounded-lg p-3 text-left transition-all duration-200',
                  selectedProjectId === project.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        'truncate text-sm font-medium',
                        selectedProjectId === project.id
                          ? 'text-blue-900'
                          : 'text-gray-900'
                      )}
                    >
                      {project.lab_project_code}
                    </p>
                    {project.sponsor_project_code && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {project.sponsor_project_code}
                      </p>
                    )}
                  </div>
                  <Badge color={getStatusColor(project.status)} className="flex-shrink-0">
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
                {project.sample_count !== undefined && (
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>样本数：{project.sample_count}</span>
                    <ChevronRightIcon
                      className={clsx(
                        'h-4 w-4 transition-transform',
                        selectedProjectId === project.id
                          ? 'text-blue-600'
                          : 'text-gray-400 group-hover:translate-x-0.5'
                      )}
                    />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white p-3">
        <Link
          href="/projects"
          className="flex items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          查看全部项目
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
