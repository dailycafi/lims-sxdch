import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectsService } from '@/services';
import { Project } from '@/types/api';

interface ProjectState {
  projects: Project[];
  selectedProjectId: number | null;
  isLoading: boolean;
  error: string | null;
  fetchProjects: (options?: { force?: boolean; activeOnly?: boolean }) => Promise<Project[]>;
  setSelectedProject: (projectId: number | null) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: number) => void;
  reset: () => void;
}

const pickFallbackProject = (projects: Project[], preferredId: number | null) => {
  if (preferredId && projects.some((project) => project.id === preferredId)) {
    return preferredId;
  }
  return projects.length > 0 ? projects[0].id : null;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,
      isLoading: false,
      error: null,
      fetchProjects: async (options) => {
        const { force = false, activeOnly = true } = options || {};
        if (get().isLoading && !force) {
          return get().projects;
        }
        set({ isLoading: true, error: null });
        try {
          const projects = await ProjectsService.getProjects({
            active_only: activeOnly,
          });
          set((state) => ({
            projects,
            selectedProjectId: pickFallbackProject(projects, state.selectedProjectId),
            isLoading: false,
            error: null,
          }));
          return projects;
        } catch (error: any) {
          set({ isLoading: false, error: error?.message || '加载项目失败' });
          throw error;
        }
      },
      setSelectedProject: (projectId) => {
        set({ selectedProjectId: projectId });
      },
      addProject: (project) => {
        set((state) => {
          const projects = [project, ...state.projects.filter((item) => item.id !== project.id)];
          return {
            projects,
            selectedProjectId: project.id,
          };
        });
      },
      removeProject: (projectId) => {
        set((state) => {
          const projects = state.projects.filter((project) => project.id !== projectId);
          const selectedProjectId =
            state.selectedProjectId === projectId
              ? pickFallbackProject(projects, null)
              : state.selectedProjectId;
          return {
            projects,
            selectedProjectId,
          };
        });
      },
      reset: () => {
        set({ projects: [], selectedProjectId: null, error: null });
      },
    }),
    {
      name: 'lims-project-store',
      partialize: (state) => ({ selectedProjectId: state.selectedProjectId }),
    }
  )
);
