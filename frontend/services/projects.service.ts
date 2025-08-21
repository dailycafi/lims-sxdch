import { api } from '@/lib/api';
import { Project, ProjectCreate } from '@/types/api';

export class ProjectsService {
  /**
   * 获取项目列表
   */
  static async getProjects(params?: {
    skip?: number;
    limit?: number;
    active_only?: boolean;
  }): Promise<Project[]> {
    const response = await api.get<Project[]>('/projects', { params });
    return response.data;
  }

  /**
   * 获取单个项目详情
   */
  static async getProject(id: number): Promise<Project> {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  }

  /**
   * 创建新项目
   */
  static async createProject(data: ProjectCreate): Promise<Project> {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  }

  /**
   * 更新项目
   */
  static async updateProject(id: number, data: Partial<ProjectCreate>): Promise<Project> {
    const response = await api.put<Project>(`/projects/${id}`, data);
    return response.data;
  }

  /**
   * 删除项目
   */
  static async deleteProject(id: number): Promise<void> {
    await api.delete(`/projects/${id}`);
  }
}
