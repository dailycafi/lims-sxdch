import { api } from '@/lib/api';

export interface ArchiveProject {
  id: number;
  project_id: number;
  project?: any;
  archive_reason: string;
  archive_date: string;
  archived_by: number;
  archived_by_user?: any;
  archive_location?: string;
  retention_period?: number;
  notes?: string;
  created_at: string;
}

export interface ArchiveRequest {
  project_id: number;
  archive_reason: string;
  archive_location?: string;
  retention_period?: number;
  notes?: string;
  signature: string;
}

export class ArchiveService {
  /**
   * 获取归档项目列表
   */
  static async getArchivedProjects(params?: {
    skip?: number;
    limit?: number;
  }): Promise<ArchiveProject[]> {
    const response = await api.get<ArchiveProject[]>('/archive/projects', { params });
    return response.data;
  }

  /**
   * 获取单个归档项目详情
   */
  static async getArchivedProject(id: number): Promise<ArchiveProject> {
    const response = await api.get<ArchiveProject>(`/archive/projects/${id}`);
    return response.data;
  }

  /**
   * 归档项目
   */
  static async archiveProject(data: ArchiveRequest): Promise<ArchiveProject> {
    const response = await api.post<ArchiveProject>('/archive/projects', data);
    return response.data;
  }

  /**
   * 恢复归档项目
   */
  static async restoreProject(id: number, data: {
    restore_reason: string;
    signature: string;
  }): Promise<void> {
    await api.post(`/archive/projects/${id}/restore`, data);
  }

  /**
   * 检查项目是否可以归档
   */
  static async checkArchivable(projectId: number): Promise<{
    can_archive: boolean;
    reasons?: string[];
  }> {
    const response = await api.get(`/archive/projects/${projectId}/check`);
    return response.data;
  }
}
