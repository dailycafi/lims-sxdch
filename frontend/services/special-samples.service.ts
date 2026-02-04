import { api } from '@/lib/api';

// Enums
export type SpecialSampleType = 'SC' | 'QC' | 'BLANK' | 'OTHER';
export type SpecialSampleStatus = 'pending' | 'approved' | 'rejected' | 'received' | 'in_storage' | 'checked_out' | 'transferred' | 'destroyed';

// Types
export interface SpecialSampleApplication {
  id: number;
  application_code: string;
  project_code_prefix: string;
  project_code_separator: string;
  project_code_suffix?: string;
  sample_type: SpecialSampleType;
  sample_name: string;
  sample_source?: string;
  sample_count: number;
  unit: string;
  storage_temperature?: string;
  storage_conditions?: string;
  purpose?: string;
  notes?: string;
  status: SpecialSampleStatus;
  requested_by: number;
  requester_name?: string;
  approved_by?: number;
  approver_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
}

export interface SpecialSampleApplicationCreate {
  project_code_prefix: string;
  project_code_separator?: string;
  project_code_suffix?: string;
  sample_type: SpecialSampleType;
  sample_name: string;
  sample_source?: string;
  sample_count: number;
  unit?: string;
  storage_temperature?: string;
  storage_conditions?: string;
  purpose?: string;
  notes?: string;
}

export interface SpecialSample {
  id: number;
  application_id: number;
  sample_code: string;
  barcode?: string;
  sample_type: SpecialSampleType;
  sample_name: string;
  sequence_number: number;
  status: SpecialSampleStatus;
  freezer_id?: string;
  shelf_level?: string;
  rack_position?: string;
  box_code?: string;
  position_in_box?: string;
  received_by?: number;
  received_at?: string;
  label_printed: boolean;
  label_printed_at?: string;
  print_count: number;
  created_at: string;
}

export interface SpecialSampleConfig {
  id: number;
  sample_type: SpecialSampleType;
  prefix: string;
  default_separator: string;
  allow_custom_separator: boolean;
  code_optional: boolean;
  label_width: number;
  label_height: number;
  font_size: number;
  barcode_enabled: boolean;
  barcode_format: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SpecialSampleStatistics {
  by_status: Record<SpecialSampleStatus, number>;
  by_type: Record<SpecialSampleType, number>;
  pending_applications: number;
  total_samples: number;
}

export interface PrintedLabel {
  id: number;
  sample_code: string;
  barcode: string;
  sample_type: SpecialSampleType;
  sample_name: string;
  sequence_number: number;
}

// Service class
export class SpecialSamplesService {
  // ============ Applications ============

  /**
   * Get applications list
   */
  static async getApplications(params?: {
    status?: SpecialSampleStatus;
    sample_type?: SpecialSampleType;
    skip?: number;
    limit?: number;
  }): Promise<SpecialSampleApplication[]> {
    const response = await api.get<SpecialSampleApplication[]>('/special-samples/applications', { params });
    return response.data;
  }

  /**
   * Get single application
   */
  static async getApplication(id: number): Promise<SpecialSampleApplication> {
    const response = await api.get<SpecialSampleApplication>(`/special-samples/applications/${id}`);
    return response.data;
  }

  /**
   * Create new application
   */
  static async createApplication(data: SpecialSampleApplicationCreate): Promise<SpecialSampleApplication> {
    const response = await api.post<SpecialSampleApplication>('/special-samples/applications', data);
    return response.data;
  }

  /**
   * Approve or reject application
   */
  static async approveApplication(
    id: number,
    approved: boolean,
    rejection_reason?: string
  ): Promise<{ message: string; status: string }> {
    const response = await api.post<{ message: string; status: string }>(
      `/special-samples/applications/${id}/approve`,
      { approved, rejection_reason }
    );
    return response.data;
  }

  // ============ Samples ============

  /**
   * Get samples list
   */
  static async getSamples(params?: {
    application_id?: number;
    status?: SpecialSampleStatus;
    sample_type?: SpecialSampleType;
    keyword?: string;
    skip?: number;
    limit?: number;
  }): Promise<SpecialSample[]> {
    const response = await api.get<SpecialSample[]>('/special-samples/samples', { params });
    return response.data;
  }

  /**
   * Get single sample
   */
  static async getSample(id: number): Promise<SpecialSample> {
    const response = await api.get<SpecialSample>(`/special-samples/samples/${id}`);
    return response.data;
  }

  /**
   * Receive samples
   */
  static async receiveSamples(
    sample_ids: number[],
    storage_location?: string,
    notes?: string
  ): Promise<{ message: string; received_count: number }> {
    const response = await api.post<{ message: string; received_count: number }>(
      '/special-samples/samples/receive',
      { sample_ids, storage_location, notes }
    );
    return response.data;
  }

  /**
   * Print sample labels
   */
  static async printLabels(sample_ids: number[]): Promise<{ message: string; labels: PrintedLabel[] }> {
    const response = await api.post<{ message: string; labels: PrintedLabel[] }>(
      '/special-samples/samples/print-labels',
      { sample_ids }
    );
    return response.data;
  }

  // ============ Configuration ============

  /**
   * Get all configurations
   */
  static async getConfigs(sample_type?: SpecialSampleType): Promise<SpecialSampleConfig[]> {
    const params = sample_type ? { sample_type } : undefined;
    const response = await api.get<SpecialSampleConfig[]>('/special-samples/configs', { params });
    return response.data;
  }

  /**
   * Get configuration by sample type
   */
  static async getConfig(sample_type: SpecialSampleType): Promise<SpecialSampleConfig> {
    const response = await api.get<SpecialSampleConfig>(`/special-samples/configs/${sample_type}`);
    return response.data;
  }

  /**
   * Create or update configuration
   */
  static async saveConfig(data: Partial<SpecialSampleConfig> & { sample_type: SpecialSampleType }): Promise<SpecialSampleConfig> {
    const response = await api.post<SpecialSampleConfig>('/special-samples/configs', data);
    return response.data;
  }

  // ============ Statistics ============

  /**
   * Get statistics
   */
  static async getStatistics(): Promise<SpecialSampleStatistics> {
    const response = await api.get<SpecialSampleStatistics>('/special-samples/statistics');
    return response.data;
  }
}

// Sample type labels (Chinese)
export const SAMPLE_TYPE_LABELS: Record<SpecialSampleType, string> = {
  SC: '标准品 (SC)',
  QC: '质控品 (QC)',
  BLANK: '空白基质',
  OTHER: '其他',
};

// Sample status labels (Chinese)
export const SAMPLE_STATUS_LABELS: Record<SpecialSampleStatus, string> = {
  pending: '待审批',
  approved: '已审批',
  rejected: '已拒绝',
  received: '已接收',
  in_storage: '已入库',
  checked_out: '已领用',
  transferred: '已转移',
  destroyed: '已销毁',
};

// Status badge colors
export const STATUS_COLORS: Record<SpecialSampleStatus, 'zinc' | 'amber' | 'green' | 'red' | 'blue' | 'purple'> = {
  pending: 'amber',
  approved: 'blue',
  rejected: 'red',
  received: 'green',
  in_storage: 'green',
  checked_out: 'purple',
  transferred: 'zinc',
  destroyed: 'zinc',
};
