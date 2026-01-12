import { api } from '@/lib/api';

// Types
export interface LabelConfig {
  id: number;
  project_id: number;
  label_type: 'sampling_tube' | 'cryo_tube';
  name: string;
  config: Record<string, any> | null;
  separator: string;
  label_width: number;
  label_height: number;
  font_size: number;
  barcode_enabled: boolean;
  qrcode_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface LabelConfigCreate {
  project_id: number;
  label_type: 'sampling_tube' | 'cryo_tube';
  name: string;
  config?: Record<string, any>;
  separator?: string;
  label_width?: number;
  label_height?: number;
  font_size?: number;
  barcode_enabled?: boolean;
  qrcode_enabled?: boolean;
}

export interface LabelConfigUpdate {
  name?: string;
  config?: Record<string, any>;
  separator?: string;
  label_width?: number;
  label_height?: number;
  font_size?: number;
  barcode_enabled?: boolean;
  qrcode_enabled?: boolean;
  is_active?: boolean;
  audit_reason?: string;
}

export interface Label {
  id: number;
  label_code: string;
  internal_code?: string;  // 系统内部编号（有空值时使用）
  label_type: string;
  components: Record<string, any> | null;
  display_components?: Record<string, any> | null;  // 显示用组件值（空值替换为下划线）
  is_printed: boolean;
  printed_at?: string;
  print_count: number;
  created_at: string;
}

export interface LabelBatch {
  id: number;
  project_id: number;
  batch_code: string;
  label_type: string;
  generation_params: Record<string, any> | null;
  total_count: number;
  printed_count: number;
  status: 'generated' | 'printed' | 'partial_printed';
  generated_at: string;
  labels?: Label[];
}

export interface GenerateLabelsRequest {
  project_id: number;
  label_type: 'sampling_tube' | 'cryo_tube';
  config_id?: number;
  selected_options: Record<string, string[]>;
}

export interface GenerateLabelsResponse {
  batch_id: number;
  batch_code: string;
  total_count: number;
  label_codes: string[];
}

export interface CheckDuplicateResponse {
  has_duplicates: boolean;
  duplicate_codes: string[];
}

export class LabelsService {
  // ============ Label Config ============
  
  /**
   * 获取标签配置列表
   */
  static async getConfigs(params?: { project_id?: number; label_type?: string }): Promise<LabelConfig[]> {
    const response = await api.get<LabelConfig[]>('/labels/configs', { params });
    return response.data;
  }

  /**
   * 获取单个标签配置
   */
  static async getConfig(configId: number): Promise<LabelConfig> {
    const response = await api.get<LabelConfig>(`/labels/configs/${configId}`);
    return response.data;
  }

  /**
   * 创建标签配置
   */
  static async createConfig(data: LabelConfigCreate): Promise<LabelConfig> {
    const response = await api.post<LabelConfig>('/labels/configs', data);
    return response.data;
  }

  /**
   * 更新标签配置
   */
  static async updateConfig(configId: number, data: LabelConfigUpdate): Promise<LabelConfig> {
    const response = await api.put<LabelConfig>(`/labels/configs/${configId}`, data);
    return response.data;
  }

  /**
   * 删除标签配置
   */
  static async deleteConfig(configId: number): Promise<void> {
    await api.delete(`/labels/configs/${configId}`);
  }

  // ============ Label Generation ============

  /**
   * 生成标签编号
   */
  static async generateLabels(data: GenerateLabelsRequest): Promise<GenerateLabelsResponse> {
    const response = await api.post<GenerateLabelsResponse>('/labels/generate', data);
    return response.data;
  }

  /**
   * 检查编号是否重复
   */
  static async checkDuplicates(projectId: number, labelCodes: string[]): Promise<CheckDuplicateResponse> {
    const response = await api.post<CheckDuplicateResponse>('/labels/check-duplicates', {
      project_id: projectId,
      label_codes: labelCodes
    });
    return response.data;
  }

  // ============ Label Batches ============

  /**
   * 获取标签批次列表
   */
  static async getBatches(params?: { 
    project_id?: number; 
    label_type?: string;
    skip?: number;
    limit?: number;
  }): Promise<LabelBatch[]> {
    const response = await api.get<LabelBatch[]>('/labels/batches', { params });
    return response.data;
  }

  /**
   * 获取单个批次详情
   */
  static async getBatch(batchId: number, includeLabels = false): Promise<LabelBatch> {
    const response = await api.get<LabelBatch>(`/labels/batches/${batchId}`, {
      params: { include_labels: includeLabels }
    });
    return response.data;
  }

  /**
   * 获取批次下的标签列表
   */
  static async getBatchLabels(batchId: number, params?: { skip?: number; limit?: number }): Promise<Label[]> {
    const response = await api.get<Label[]>(`/labels/batches/${batchId}/labels`, { params });
    return response.data;
  }

  /**
   * 标记批次已打印
   */
  static async markBatchPrinted(batchId: number, labelIds?: number[]): Promise<{ message: string; printed_count: number }> {
    const response = await api.post<{ message: string; printed_count: number }>(
      `/labels/batches/${batchId}/print`,
      labelIds ? { label_ids: labelIds } : undefined
    );
    return response.data;
  }

  // ============ Label Search ============

  /**
   * 搜索标签
   */
  static async searchLabels(params: {
    project_id?: number;
    label_type?: string;
    keyword?: string;
    is_printed?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<Label[]> {
    const response = await api.get<Label[]>('/labels/search', { params });
    return response.data;
  }
}
