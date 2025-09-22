import { api } from '@/lib/api';
import { Statistics } from '@/types/api';

export interface SampleStatistics {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_project: Record<string, number>;
}

export interface ProjectStatistics {
  total: number;
  by_status: Record<string, number>;
  by_organization: Record<string, number>;
}

export interface UserStatistics {
  total: number;
  by_role: Record<string, number>;
  active_users: number;
}

export class StatisticsService {
  /**
   * 获取总体统计数据
   */
  static async getOverviewStatistics(): Promise<Statistics> {
    const response = await api.get<Statistics>('/statistics/summary');
    return response.data;
  }

  /**
   * 获取样本统计数据
   */
  static async getSampleStatistics(params?: {
    start_date?: string;
    end_date?: string;
    project_id?: number;
  }): Promise<SampleStatistics> {
    const response = await api.get<SampleStatistics>('/statistics/samples', { params });
    return response.data;
  }

  /**
   * 获取项目统计数据
   */
  static async getProjectStatistics(params?: {
    start_date?: string;
    end_date?: string;
    organization_id?: number;
  }): Promise<ProjectStatistics> {
    const response = await api.get<ProjectStatistics>('/statistics/projects', { params });
    return response.data;
  }

  /**
   * 获取用户统计数据
   */
  static async getUserStatistics(): Promise<UserStatistics> {
    const response = await api.get<UserStatistics>('/statistics/users');
    return response.data;
  }

  /**
   * 获取活动趋势
   */
  static async getActivityTrends(params?: {
    period?: 'day' | 'week' | 'month';
    start_date?: string;
    end_date?: string;
  }): Promise<any> {
    const response = await api.get('/statistics/trends', { params });
    return response.data;
  }

  /**
   * 导出统计报告
   */
  static async exportReport(params?: {
    type: 'samples' | 'projects' | 'users' | 'overview';
    format?: 'pdf' | 'excel';
    start_date?: string;
    end_date?: string;
  }): Promise<Blob> {
    const response = await api.get('/statistics/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
}
