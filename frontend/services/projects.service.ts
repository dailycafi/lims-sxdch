import { api } from '@/lib/api';
import { Project, ProjectCreate, ProjectOrganizationLink, ProjectOrganizationLinkCreate, ProjectOrganizationLinkUpdate } from '@/types/api';

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

  /**
   * 获取项目关联组织列表
   */
  static async getProjectOrganizations(projectId: number): Promise<ProjectOrganizationLink[]> {
    const response = await api.get<ProjectOrganizationLink[]>(`/projects/${projectId}/organizations`);
    return response.data;
  }

  /**
   * 关联组织到项目
   */
  static async addProjectOrganization(projectId: number, data: ProjectOrganizationLinkCreate): Promise<ProjectOrganizationLink> {
    const response = await api.post<ProjectOrganizationLink>(`/projects/${projectId}/organizations`, data);
    return response.data;
  }

  /**
   * 更新项目-组织关联信息（项目维度）
   */
  static async updateProjectOrganization(projectId: number, linkId: number, data: ProjectOrganizationLinkUpdate): Promise<ProjectOrganizationLink> {
    const response = await api.patch<ProjectOrganizationLink>(`/projects/${projectId}/organizations/${linkId}`, data);
    return response.data;
  }

  /**
   * 移除项目-组织关联
   */
  static async removeProjectOrganization(projectId: number, linkId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/organizations/${linkId}`);
  }
}
