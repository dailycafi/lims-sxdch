/**
 * 空白基质服务
 */
import { api } from '@/lib/api';

export interface BlankMatrixReceiveRecord {
  id: number;
  project_id: number;
  project_name?: string;
  project_code?: string;
  source_name: string;
  source_contact?: string;
  source_phone?: string;
  consent_files?: string[];
  ethics_files?: string[];
  medical_report_files?: string[];
  anticoagulants: string[];
  matrix_type: string;
  matrix_type_other?: string;
  received_by: number;
  received_by_name?: string;
  received_at: string;
  status: string;
  notes?: string;
  sample_count: number;
  samples?: BlankMatrixSample[];
  created_at: string;
  updated_at?: string;
}

export interface BlankMatrixSample {
  id: number;
  sample_code: string;
  barcode?: string;
  receive_record_id: number;
  project_id: number;
  anticoagulant?: string;
  matrix_type: string;
  edta_volume?: number;
  heparin_volume?: number;
  citrate_volume?: number;
  total_volume?: number;
  status: string;
  special_notes?: string;
  freezer_id?: string;
  shelf_level?: string;
  rack_position?: string;
  box_code?: string;
  position_in_box?: string;
  inventoried_by?: number;
  inventoried_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface InventorySampleItem {
  sample_code: string;
  anticoagulant?: string;
  edta_volume?: number;
  heparin_volume?: number;
  citrate_volume?: number;
  special_notes?: string;
}

export interface InventorySubmitData {
  receive_record_id: number;
  samples: InventorySampleItem[];
  storage_location?: string;
  is_final: boolean;
}

export interface MatrixTypeOption {
  value: string;
  label: string;
}

export interface MatrixTypesResponse {
  anticoagulants: MatrixTypeOption[];
  matrix_types: MatrixTypeOption[];
}

export const BlankMatrixService = {
  /**
   * 接收空白基质
   */
  async receive(formData: FormData): Promise<{ success: boolean; message: string; receive_record_id: number }> {
    const response = await api.post('/blank-matrix/receive', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * 获取接收任务列表
   */
  async getReceiveTasks(params?: {
    project_id?: number;
    status?: string;
  }): Promise<BlankMatrixReceiveRecord[]> {
    const response = await api.get('/blank-matrix/receive/tasks', { params });
    return response.data;
  },

  /**
   * 获取单个接收记录详情
   */
  async getReceiveRecord(recordId: number): Promise<BlankMatrixReceiveRecord> {
    const response = await api.get(`/blank-matrix/receive/${recordId}`);
    return response.data;
  },

  /**
   * 清点/入库空白基质
   */
  async inventory(data: InventorySubmitData): Promise<{ success: boolean; message: string; sample_count: number }> {
    const response = await api.post('/blank-matrix/inventory', data);
    return response.data;
  },

  /**
   * 获取空白基质样本列表
   */
  async getSamples(params?: {
    project_id?: number;
    status?: string;
    receive_record_id?: number;
  }): Promise<BlankMatrixSample[]> {
    const response = await api.get('/blank-matrix/samples', { params });
    return response.data;
  },

  /**
   * 生成空白基质编号
   */
  async generateCodes(data: {
    project_code: string;
    anticoagulant: string;
    count: number;
  }): Promise<{ codes: string[] }> {
    const formData = new FormData();
    formData.append('project_code', data.project_code);
    formData.append('anticoagulant', data.anticoagulant);
    formData.append('count', String(data.count));

    const response = await api.post('/blank-matrix/generate-codes', formData);
    return response.data;
  },

  /**
   * 获取基质类型选项
   */
  async getMatrixTypes(): Promise<MatrixTypesResponse> {
    const response = await api.get('/blank-matrix/matrix-types');
    return response.data;
  },
};
