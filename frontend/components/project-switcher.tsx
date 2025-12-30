import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/20/solid';
import { Button } from '@/components/button';
import { Select } from '@/components/select';
import { useAuthStore } from '@/store/auth';
import { useProjectStore } from '@/store/project';

export function ProjectSwitcher() {
  const { user } = useAuthStore();
  const {
    projects,
    selectedProjectId,
    isLoading,
    fetchProjects,
    setSelectedProject,
  } = useProjectStore();

  useEffect(() => {
    if (!projects.length) {
      fetchProjects().catch(() => {
        /* 全局错误提示由调用方处理 */
      });
    }
  }, [projects.length, fetchProjects]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.lab_project_code || project.sponsor_project_code,
        subLabel: project.sponsor_project_code || '',
      })),
    [projects]
  );

  const canCreateProject = user?.role === 'system_admin' || user?.role === 'sample_admin';

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-medium text-zinc-500 lg:block whitespace-nowrap">当前项目</span>
      <div className="flex flex-col gap-1">
        <Select
          value={selectedProjectId ? String(selectedProjectId) : ''}
          onChange={(event) => {
            const value = event.target.value;
            setSelectedProject(value ? Number(value) : null);
          }}
          disabled={isLoading || projects.length === 0}
          className="w-full min-w-[140px] sm:min-w-[180px] text-xs h-9"
        >
          <option value="">{projects.length ? '请选择项目' : '暂无可用项目'}</option>
          {projectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {option.subLabel && option.subLabel !== option.label
                ? `（${option.subLabel}）`
                : ''}
            </option>
          ))}
        </Select>
        {!isLoading && projects.length === 0 && (
          <span className="text-[11px] text-zinc-500 whitespace-nowrap">
            无可用项目，请联系管理员为你授权项目
          </span>
        )}
      </div>
    </div>
  );
}
