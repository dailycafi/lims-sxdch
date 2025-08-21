import { api } from '@/lib/api';
import { Sample, SampleCreate, SampleBorrowRequest, SampleTransferRequest } from '@/types/api';

export class SamplesService {
  /**
   * 获取样本列表
   */
  static async getSamples(params?: {
    project_id?: number;
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<Sample[]> {
    const response = await api.get<Sample[]>('/samples', { params });
    return response.data;
  }

  /**
   * 获取单个样本详情
   */
  static async getSample(id: number): Promise<Sample> {
    const response = await api.get<Sample>(`/samples/${id}`);
    return response.data;
  }

  /**
   * 创建新样本
   */
  static async createSample(data: SampleCreate): Promise<Sample> {
    const response = await api.post<Sample>('/samples', data);
    return response.data;
  }

  /**
   * 批量创建样本
   */
  static async createSamplesBatch(data: SampleCreate[]): Promise<Sample[]> {
    const response = await api.post<Sample[]>('/samples/batch', data);
    return response.data;
  }

  /**
   * 更新样本
   */
  static async updateSample(id: number, data: Partial<SampleCreate>): Promise<Sample> {
    const response = await api.put<Sample>(`/samples/${id}`, data);
    return response.data;
  }

  /**
   * 删除样本
   */
  static async deleteSample(id: number): Promise<void> {
    await api.delete(`/samples/${id}`);
  }

  /**
   * 样本入库
   */
  static async receiveSamples(data: SampleCreate[]): Promise<Sample[]> {
    const response = await api.post<Sample[]>('/samples/receive', data);
    return response.data;
  }

  /**
   * 样本借用
   */
  static async borrowSample(data: SampleBorrowRequest): Promise<any> {
    const response = await api.post('/samples/borrow', data);
    return response.data;
  }

  /**
   * 获取借用记录
   */
  static async getBorrowRecords(sampleId?: number): Promise<any[]> {
    const params = sampleId ? { sample_id: sampleId } : undefined;
    const response = await api.get('/samples/borrow-records', { params });
    return response.data;
  }

  /**
   * 执行借用
   */
  static async executeBorrow(borrowId: number, signature: string): Promise<any> {
    const response = await api.post(`/samples/borrow/${borrowId}/execute`, { signature });
    return response.data;
  }

  /**
   * 样本归还
   */
  static async returnSample(borrowId: number, data: {
    actual_return_quantity: number;
    return_notes?: string;
    signature: string;
  }): Promise<any> {
    const response = await api.post(`/samples/borrow/${borrowId}/return`, data);
    return response.data;
  }

  /**
   * 样本转移
   */
  static async transferSample(data: SampleTransferRequest): Promise<any> {
    const response = await api.post('/samples/transfer', data);
    return response.data;
  }

  /**
   * 获取转移记录
   */
  static async getTransferRecords(sampleId?: number): Promise<any[]> {
    const params = sampleId ? { sample_id: sampleId } : undefined;
    const response = await api.get('/samples/transfer-records', { params });
    return response.data;
  }

  /**
   * 样本销毁申请
   */
  static async requestDestroy(data: {
    sample_id: number;
    quantity: number;
    unit: string;
    reason: string;
  }): Promise<any> {
    const response = await api.post('/samples/destroy-request', data);
    return response.data;
  }

  /**
   * 获取销毁记录
   */
  static async getDestroyRecords(sampleId?: number): Promise<any[]> {
    const params = sampleId ? { sample_id: sampleId } : undefined;
    const response = await api.get('/samples/destroy-records', { params });
    return response.data;
  }

  /**
   * 审批销毁申请
   */
  static async approveDestroy(requestId: number, data: {
    approved: boolean;
    review_notes?: string;
    signature: string;
  }): Promise<any> {
    const response = await api.post(`/samples/destroy-request/${requestId}/review`, data);
    return response.data;
  }

  /**
   * 执行销毁
   */
  static async executeDestroy(requestId: number, data: {
    signature: string;
    destruction_method?: string;
    destruction_notes?: string;
  }): Promise<any> {
    const response = await api.post(`/samples/destroy-request/${requestId}/execute`, data);
    return response.data;
  }

  /**
   * 样本库存盘点
   */
  static async inventoryCheck(sampleId: number, data: {
    actual_quantity: number;
    notes?: string;
  }): Promise<any> {
    const response = await api.post(`/samples/${sampleId}/inventory`, data);
    return response.data;
  }

  /**
   * 获取库存记录
   */
  static async getInventoryRecords(sampleId: number): Promise<any[]> {
    const response = await api.get(`/samples/${sampleId}/inventory-records`);
    return response.data;
  }
}
