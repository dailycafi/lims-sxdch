import { api } from '@/lib/api';
import { Deviation, DeviationCreate } from '@/types/api';

export interface DeviationUpdate extends DeviationCreate {
  status?: string;
  resolution?: string;
  closed_by?: number;
  closed_at?: string;
}

export class DeviationsService {
  /**
   * 获取偏差列表
   */
  static async getDeviations(params?: {
    status?: string;
    severity?: 'low' | 'medium' | 'high';
    type?: string;
    skip?: number;
    limit?: number;
  }): Promise<Deviation[]> {
    const response = await api.get<Deviation[]>('/deviations', { params });
    return response.data;
  }

  /**
   * 获取单个偏差详情
   */
  static async getDeviation(id: number): Promise<Deviation> {
    const response = await api.get<Deviation>(`/deviations/${id}`);
    return response.data;
  }

  /**
   * 创建新偏差
   */
  static async createDeviation(data: DeviationCreate): Promise<Deviation> {
    const response = await api.post<Deviation>('/deviations', data);
    return response.data;
  }

  /**
   * 更新偏差
   */
  static async updateDeviation(id: number, data: DeviationUpdate): Promise<Deviation> {
    const response = await api.put<Deviation>(`/deviations/${id}`, data);
    return response.data;
  }

  /**
   * 关闭偏差
   */
  static async closeDeviation(id: number, data: {
    resolution: string;
    signature: string;
  }): Promise<Deviation> {
    const response = await api.post<Deviation>(`/deviations/${id}/close`, data);
    return response.data;
  }

  /**
   * 删除偏差
   */
  static async deleteDeviation(id: number): Promise<void> {
    await api.delete(`/deviations/${id}`);
  }
}
