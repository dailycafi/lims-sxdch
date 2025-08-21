import { api } from '@/lib/api';
import { AuditLog } from '@/types/api';

export class AuditService {
  /**
   * 获取审计日志列表
   */
  static async getAuditLogs(params?: {
    entity_type?: string;
    entity_id?: number;
    user_id?: number;
    action?: string;
    start_date?: string;
    end_date?: string;
    skip?: number;
    limit?: number;
  }): Promise<AuditLog[]> {
    const response = await api.get<AuditLog[]>('/audit/logs', { params });
    return response.data;
  }

  /**
   * 获取单个审计日志详情
   */
  static async getAuditLog(id: number): Promise<AuditLog> {
    const response = await api.get<AuditLog>(`/audit/logs/${id}`);
    return response.data;
  }

  /**
   * 导出审计日志
   */
  static async exportAuditLogs(params?: {
    entity_type?: string;
    start_date?: string;
    end_date?: string;
    format?: 'csv' | 'excel';
  }): Promise<Blob> {
    const response = await api.get('/audit/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
}
